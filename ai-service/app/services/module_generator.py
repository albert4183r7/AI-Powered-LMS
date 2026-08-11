"""Interface implemented by fake and provider-backed module generators."""

from typing import Protocol

from app.schemas.generation import ModuleGenerationRequest, ModulePlan


class ModuleGenerator(Protocol):
    """Generate a validated module plan from an instructor request."""

    def generate(self, generation_request: ModuleGenerationRequest) -> ModulePlan:
        """Create a module plan without deciding how generation is performed."""

        ...
