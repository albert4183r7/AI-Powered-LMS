"""Generate PowerPoint presentations from a LessonPlan using AI and Node.js layout engine."""

import json
import logging
import os
import re
import subprocess
import shutil
from pathlib import Path
from uuid import uuid4
from pydantic import ValidationError

from app.schemas.generation import LessonPlan, PresentationPlan
from app.providers.ecoapi import EcoApiClient, EcoApiChatMessage

LOGGER = logging.getLogger(__name__)


def _extract_json_from_fences(text: str) -> str:
    stripped_content = text.strip()
    matches = re.findall(r"```(?:json)?\s*(.*?)```", stripped_content, re.DOTALL | re.IGNORECASE)
    
    valid_blocks = []
    for match in matches:
        match_stripped = match.strip()
        if match_stripped.startswith('{') or match_stripped.startswith('['):
            valid_blocks.append(match_stripped)
            
    if valid_blocks:
        # Return the longest block as it's most likely the full response
        return max(valid_blocks, key=len)

    start = stripped_content.find('{')
    end = stripped_content.rfind('}')
    if start != -1 and end != -1 and end > start:
        return stripped_content[start:end+1]
        
    return stripped_content


class PresentationGenerator:
    """Generate .pptx files based on lesson plans using LLM and pptx-ai-kit."""

    def __init__(
        self, 
        upload_dir: str | Path = "../../uploads",
        ecoapi_client: EcoApiClient | None = None,
    ) -> None:
        self.upload_dir = Path(upload_dir).resolve()
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self._ecoapi_client = ecoapi_client
        self.renderer_dir = Path(__file__).resolve().parent.parent.parent / "ppt-renderer"

    def generate(
        self, 
        lesson_plan: LessonPlan, 
        course_title: str,
        module_instruction: str = "",
        rag_context: str = "",
    ) -> dict[str, str]:
        """
        Generate a PowerPoint file for the lesson and return its metadata.
        Returns a dictionary with 'file_name' and 'file_path' (URL route).
        """
        
        presentation_plan = self._generate_presentation_plan(
            lesson_plan, course_title, module_instruction, rag_context
        )
        
        file_id = str(uuid4())
        file_name = f"{lesson_plan.title.replace(' ', '_')}_{file_id[:8]}.pptx"
        file_name = "".join(c for c in file_name if c.isalnum() or c in ("_", "-", "."))
        final_file_path = self.upload_dir / file_name
        
        if presentation_plan and presentation_plan.slides:
            # Prepare JSON for renderer
            presentation_plan.meta.fileName = str(final_file_path.absolute())
            spec_json = presentation_plan.model_dump_json(exclude_none=True)
            
            temp_json_path = self.renderer_dir / f"temp_spec_{file_id}.json"
            temp_json_path.write_text(spec_json, encoding="utf-8")
            
            try:
                # Call Node.js renderer
                result = subprocess.run(
                    ["node", "build_deck.js", temp_json_path.name],
                    cwd=str(self.renderer_dir),
                    capture_output=True,
                    text=True,
                    check=True
                )
                LOGGER.info("Successfully built PPT with pptx-ai-kit: %s", result.stdout)
            except subprocess.CalledProcessError as e:
                LOGGER.error("Failed to build PPT using pptx-ai-kit: %s\n%s", e, e.stderr)
                raise
            finally:
                if temp_json_path.exists():
                    temp_json_path.unlink()
        else:
            raise ValueError("Failed to generate PresentationPlan from LLM.")

        return {
            "fileName": file_name,
            "filePath": f"/uploads/{file_name}",
        }
        
    def _generate_presentation_plan(
        self,
        lesson_plan: LessonPlan,
        course_title: str,
        module_instruction: str,
        rag_context: str,
    ) -> PresentationPlan | None:
        """Use the LLM to generate slide contents based on contexts."""
        if not self._ecoapi_client:
            LOGGER.warning("No EcoApiClient provided to PresentationGenerator. Skipping AI generation.")
            return None
            
        design_rules_path = self.renderer_dir / "DESIGN_RULES.md"
        design_rules = ""
        if design_rules_path.exists():
            design_rules = design_rules_path.read_text(encoding="utf-8")
            
        system_prompt = (
            "You are an expert presentation designer and curriculum developer. "
            "Your task is to generate the structure and content for a PowerPoint presentation for a specific lesson.\n"
            "You must respond ONLY with a valid JSON object matching the requested schema. "
            "DO NOT explain the schema. DO NOT add any conversational text, markdown code fences, or explanations. "
            "Your entire response MUST be the final JSON object containing the presentation plan.\n\n"
            f"Here are the DESIGN RULES you must follow when choosing slide layouts:\n\n{design_rules}"
        )
        
        user_prompt = f"""
Course Title: {course_title}
Lesson Title: {lesson_plan.title}
Lesson Description: {lesson_plan.description}
Learning Objectives: {', '.join(lesson_plan.learning_objectives)}

User's Module Instruction:
{module_instruction}

Reference Material Context (if any):
{rag_context if rag_context else 'No reference material provided. Rely on your own knowledge and the module instruction.'}

Based on the above, generate a detailed PresentationPlan for this lesson. 
Provide 3 to 10 slides. Choose appropriate layouts for the content.
Available icons: assets/icons/sun_navy.png, assets/icons/water_navy.png, assets/icons/leaf_navy.png, assets/icons/bolt_navy.png, assets/icons/robot_navy.png (or just leave icon null).

IMPORTANT INSTRUCTION: 
Do NOT output a partial snippet or just one slide. You MUST output the COMPLETE JSON object representing the entire PresentationPlan, including BOTH the "meta" and "slides" arrays, exactly matching the schema.
"""

        # Note: The schema is now passed via response_format parameter, not in the prompt
        user_prompt += """
--- FINAL INSTRUCTIONS ---
Your task is to generate a concrete JSON instance that represents a 3-10 slide presentation for this specific lesson.
The JSON schema has been provided to the model separately.
DO NOT summarize or explain the schema. DO NOT output conversational text.
Your entire output MUST be the final, valid JSON object starting with `{` and ending with `}`.
"""
        
        messages = [
            EcoApiChatMessage(role="system", content=system_prompt),
            EcoApiChatMessage(role="user", content=user_prompt),
        ]
        
        # Define the response format to enforce JSON output using structured outputs
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "PresentationPlan",
                "strict": True,
                "schema": PresentationPlan.model_json_schema(),
            },
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                LOGGER.info(f"Generating PPT contents via LLM for lesson: {lesson_plan.title} (Attempt {attempt+1}/{max_retries})")
                completion = self._ecoapi_client.create_chat_completion(
                    messages,
                    max_tokens=4000,
                    response_format=response_format,
                )
                # When using response_format with json_schema, content should already be valid JSON
                content = completion.content
                if not content:
                    raise ValueError("LLM returned empty content")
                try:
                    return PresentationPlan.model_validate_json(content)
                except Exception as validation_error:
                    LOGGER.error(f"LLM returned invalid JSON on attempt {attempt+1}: {validation_error}\nRaw Content: {completion.content}")
                    if attempt == max_retries - 1:
                        raise
            except Exception as e:
                LOGGER.error(f"Failed to generate PresentationPlan via LLM on attempt {attempt+1}: {e}")
                if attempt == max_retries - 1:
                    return None
        return None
