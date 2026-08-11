import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const scrypt = promisify(scryptCallback)

interface EnterpriseModule {
  title: string
  description: string
  category: string
  cover: string
  lessons: Array<{ title: string; objective: string }>
}

const enterpriseModules: EnterpriseModule[] = [
  {
    title: 'Presales Excellence',
    description: 'Build discovery, solution-mapping, demo, and handoff skills for complex enterprise opportunities.',
    category: 'Revenue Enablement',
    cover: 'gradient-blue',
    lessons: [
      { title: 'Discovery and Qualification', objective: 'Uncover business drivers, stakeholders, constraints, and measurable outcomes.' },
      { title: 'Solution Mapping', objective: 'Translate customer needs into a defensible solution narrative.' },
      { title: 'Demo Storytelling', objective: 'Deliver a role-relevant demonstration anchored to customer value.' },
      { title: 'Proposal and Sales Handoff', objective: 'Create a clear proposal and transfer context without losing customer intent.' },
    ],
  },
  {
    title: 'Enterprise Sales Fundamentals',
    description: 'Develop a repeatable enterprise sales motion from pipeline creation through negotiation and close.',
    category: 'Revenue Enablement',
    cover: 'gradient-emerald',
    lessons: [
      { title: 'Pipeline and Account Planning', objective: 'Prioritize accounts and build an evidence-based opportunity plan.' },
      { title: 'Consultative Discovery', objective: 'Use structured questions to diagnose business impact and urgency.' },
      { title: 'Value-Based Selling', objective: 'Connect capabilities to outcomes, evidence, and executive priorities.' },
      { title: 'Negotiation and Closing', objective: 'Protect value while navigating objections, commercials, and commitments.' },
    ],
  },
  {
    title: 'Basic IT Literacy',
    description: 'Essential workplace knowledge covering devices, networks, cloud services, security, and productivity tools.',
    category: 'Digital Foundations',
    cover: 'gradient-sky',
    lessons: [
      { title: 'Computers and Operating Systems', objective: 'Understand core hardware, software, files, and operating-system concepts.' },
      { title: 'Networks and Cloud Basics', objective: 'Explain how workplace devices connect to networks and cloud services.' },
      { title: 'Cybersecurity Hygiene', objective: 'Apply safe password, phishing, data-handling, and update practices.' },
      { title: 'Workplace Productivity Tools', objective: 'Collaborate effectively with documents, communication, and shared workspaces.' },
    ],
  },
  {
    title: 'Artificial Intelligence Foundations',
    description: 'Understand modern AI, generative models, responsible use, and high-value enterprise applications.',
    category: 'Artificial Intelligence',
    cover: 'gradient-violet',
    lessons: [
      { title: 'AI and Machine Learning', objective: 'Distinguish AI, machine learning, deep learning, and common model types.' },
      { title: 'Generative AI Fundamentals', objective: 'Understand foundation models, prompting, context, and model limitations.' },
      { title: 'Responsible AI', objective: 'Recognize privacy, bias, security, transparency, and governance requirements.' },
      { title: 'Enterprise AI Use Cases', objective: 'Evaluate AI opportunities using value, feasibility, and risk.' },
    ],
  },
  {
    title: 'Agentic AI Systems',
    description: 'Design AI agents that plan, use tools, manage context, and operate safely in enterprise workflows.',
    category: 'Artificial Intelligence',
    cover: 'gradient-purple',
    lessons: [
      { title: 'Agent Architecture', objective: 'Understand goals, planning loops, state, observations, and actions.' },
      { title: 'Tool Use and Planning', objective: 'Design reliable tool contracts and controlled execution strategies.' },
      { title: 'Memory and Guardrails', objective: 'Manage context, memory, permissions, and safety boundaries.' },
      { title: 'Evaluation and Operations', objective: 'Measure agent quality, trace failures, and operate agents responsibly.' },
    ],
  },
  {
    title: 'LangChain Application Development',
    description: 'Build maintainable LLM applications with LangChain prompts, retrieval, tools, agents, and observability.',
    category: 'Artificial Intelligence',
    cover: 'gradient-amber',
    lessons: [
      { title: 'LangChain Core Concepts', objective: 'Understand models, messages, prompts, runnables, and composition.' },
      { title: 'Prompt and Model Pipelines', objective: 'Build typed, testable chains for repeatable model interactions.' },
      { title: 'Retrieval-Augmented Generation', objective: 'Ground responses using ingestion, embeddings, retrieval, and citations.' },
      { title: 'Agents and Production', objective: 'Connect tools, tracing, evaluation, and production safeguards.' },
    ],
  },
  {
    title: 'Model Context Protocol (MCP)',
    description: 'Connect AI applications to governed tools, resources, and prompts using the Model Context Protocol.',
    category: 'Artificial Intelligence',
    cover: 'gradient-rose',
    lessons: [
      { title: 'MCP Fundamentals', objective: 'Understand the protocol roles, lifecycle, and capability negotiation.' },
      { title: 'Servers Tools and Resources', objective: 'Design discoverable tools, contextual resources, and reusable prompts.' },
      { title: 'Client Integration', objective: 'Connect an AI host to MCP servers and handle responses safely.' },
      { title: 'Security and Deployment', objective: 'Apply least privilege, validation, observability, and deployment controls.' },
    ],
  },
]

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

async function main() {
  await prisma.$transaction([
    prisma.lessonProgress.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.course.deleteMany(),
  ])

  const [instructorPassword, employeePassword, adminPassword] = await Promise.all([
    hashPassword('instructor123'),
    hashPassword('employee123'),
    hashPassword('admin123'),
  ])
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@learnova.example' },
    update: { name: 'Maya Chen', role: 'instructor', password: instructorPassword },
    create: { email: 'instructor@learnova.example', name: 'Maya Chen', role: 'instructor', password: instructorPassword },
  })
  const employee = await prisma.user.upsert({
    where: { email: 'employee@learnova.example' },
    update: { name: 'Alex Morgan', role: 'employee', password: employeePassword },
    create: { email: 'employee@learnova.example', name: 'Alex Morgan', role: 'employee', password: employeePassword },
  })
  await prisma.user.upsert({
    where: { email: 'admin@learnova.example' },
    update: { name: 'Platform Admin', role: 'admin', password: adminPassword },
    create: { email: 'admin@learnova.example', name: 'Platform Admin', role: 'admin', password: adminPassword },
  })

  const createdCourses: Array<{ id: string; title: string }> = []
  for (const moduleDefinition of enterpriseModules) {
    const course = await prisma.course.create({
      data: {
        title: moduleDefinition.title,
        description: moduleDefinition.description,
        category: moduleDefinition.category,
        cover: moduleDefinition.cover,
        status: 'published',
        language: 'English',
        authorId: instructor.id,
        lessons: {
          create: moduleDefinition.lessons.map((lesson, lessonIndex) => ({
            title: lesson.title,
            description: lesson.objective,
            order: lessonIndex + 1,
          })),
        },
      },
    })
    createdCourses.push(course)
  }

  const basicItCourse = createdCourses.find((course) => course.title === 'Basic IT Literacy')
  const agenticAiCourse = createdCourses.find((course) => course.title === 'Agentic AI Systems')
  if (basicItCourse) {
    await prisma.enrollment.create({ data: { userId: employee.id, courseId: basicItCourse.id, status: 'in_progress' } })
  }
  if (agenticAiCourse) {
    await prisma.bookmark.create({ data: { userId: employee.id, courseId: agenticAiCourse.id } })
  }

  console.warn('Seeded 3 Learnova demo accounts and 7 enterprise training modules.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
