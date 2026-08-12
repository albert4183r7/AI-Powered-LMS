// i18n translations for Lumen
// Supports English and Mandarin (Simplified Chinese)

export type Lang = 'English' | 'Mandarin'

const t: Record<string, Record<Lang, string>> = {
  // Nav
  'nav.dashboard': { English: 'Dashboard', Mandarin: '仪表盘' },
  'nav.catalog': { English: 'Catalog', Mandarin: '目录' },
  'nav.myTraining': { English: 'My Training', Mandarin: '我的培训' },
  'nav.profile': { English: 'Profile', Mandarin: '个人资料' },
  'nav.newModule': { English: 'New Module', Mandarin: '新建模块' },
  'nav.manageModules': { English: 'Manage Modules', Mandarin: '管理模块' },

  // Auth
  'auth.signIn': { English: 'Sign In', Mandarin: '登录' },
  'auth.welcome': { English: 'Welcome back', Mandarin: '欢迎回来' },
  'auth.email': { English: 'Email', Mandarin: '邮箱' },
  'auth.password': { English: 'Password', Mandarin: '密码' },
  'auth.demoAccounts': { English: 'Demo Accounts', Mandarin: '演示账号' },
  'auth.signingIn': { English: 'Signing in...', Mandarin: '登录中...' },
  'auth.signInToAccount': { English: 'Sign in to your account', Mandarin: '登录您的账号' },
  'auth.accessPortal': { English: "Access your organization's training portal", Mandarin: '访问您的组织培训门户' },
  'auth.workEmail': { English: 'Work Email', Mandarin: '工作邮箱' },
  'auth.enterPassword': { English: 'Enter your password', Mandarin: '输入密码' },
  'auth.enterCredentials': { English: 'Enter your credentials to continue', Mandarin: '输入您的凭据以继续' },
  'auth.newAccount': { English: 'New Account', Mandarin: '新账号' },
  'auth.createAccount': { English: 'Create Account', Mandarin: '创建账号' },
  'auth.creatingAccount': { English: 'Creating account...', Mandarin: '创建账号中...' },
  'auth.createAccountTitle': { English: 'Create account', Mandarin: '创建账号' },
  'auth.setupAccess': { English: 'Set up your training portal access', Mandarin: '设置您的培训门户访问权限' },
  'auth.fullName': { English: 'Full Name', Mandarin: '全名' },
  'auth.createPassword': { English: 'Create a password', Mandarin: '创建密码' },
  'auth.accessRole': { English: 'Access Role', Mandarin: '访问角色' },
  'auth.instructor': { English: 'Instructor', Mandarin: '讲师' },
  'auth.employee': { English: 'Employee', Mandarin: '员工' },
  'auth.admin': { English: 'Admin', Mandarin: '管理员' },
  'auth.createManage': { English: 'Create & manage', Mandarin: '创建和管理' },
  'auth.learnComplete': { English: 'Learn & complete', Mandarin: '学习和完成' },
  'auth.internalTrainingSimplified': { English: 'Internal Training,\nSimplified.', Mandarin: '企业内部培训，\n化繁为简。' },
  'auth.platformDescription': { English: 'Enterprise training platform for onboarding, compliance, and skill development.', Mandarin: '面向入职培训、合规管理和技能发展的企业培训平台。' },
  'auth.structuredPrograms': { English: 'Structured Programs', Mandarin: '结构化培训' },
  'auth.structuredProgramsDesc': { English: 'Role-based training modules with progress tracking', Mandarin: '基于角色的培训模块，配有进度跟踪' },
  'auth.complianceTracking': { English: 'Compliance Tracking', Mandarin: '合规跟踪' },
  'auth.complianceTrackingDesc': { English: 'Monitor mandatory training completion across departments', Mandarin: '监控各部门必修培训完成情况' },
  'auth.simpleAuthoring': { English: 'Simple Course Authoring', Mandarin: '简单的课程创作' },
  'auth.simpleAuthoringDesc': { English: 'Instructors organize modules and upload presentations', Mandarin: '讲师可以组织模块并上传演示文稿' },
  'auth.loginFailed': { English: 'Invalid email or password', Mandarin: '邮箱或密码无效' },
  'auth.registrationFailed': { English: 'Registration failed. Please try again.', Mandarin: '注册失败，请重试。' },
  'auth.somethingWentWrong': { English: 'Something went wrong. Please try again.', Mandarin: '出了点问题，请重试。' },
  'auth.copyright': { English: '© {year} Lumen Enterprise Training Platform. Internal use only.', Mandarin: '© {year} Lumen 企业培训平台。仅供内部使用。' },
  'auth.enterpriseTraining': { English: 'Enterprise Training', Mandarin: '企业培训' },
  'auth.emailPlaceholder': { English: 'name@company.com', Mandarin: 'name@company.com' },
  'auth.namePlaceholder': { English: 'John Doe', Mandarin: '张三' },

  // Home Page
  'home.trainingDashboard': { English: 'Training Dashboard', Mandarin: '培训仪表盘' },
  'home.trainingCatalog': { English: 'Training Catalog', Mandarin: '培训目录' },
  'home.searchPlaceholder': { English: 'Search from the first letter...', Mandarin: '从标题首字母开始搜索...' },
  'home.noModules': { English: 'No training modules found', Mandarin: '未找到培训模块' },
  'home.aiEyebrow': { English: 'AI-powered authoring', Mandarin: 'AI 智能创作' },
  'home.aiTitle': { English: 'Create a complete training module from one instruction', Mandarin: '用一句指令创建完整培训模块' },
  'home.aiDescription': { English: 'Describe the audience, topic, and outcome. You can add references and research options before generation.', Mandarin: '描述受众、主题和目标。生成前可以添加参考资料和研究选项。' },
  'home.aiPlaceholder': { English: 'e.g. Create practical presales onboarding for new solution consultants', Mandarin: '例如：为新解决方案顾问创建实用的售前入职培训' },
  'home.aiCreate': { English: 'Create with AI', Mandarin: '使用 AI 创建' },
  'home.aiPromptMinimum': { English: 'Describe the module in at least 20 characters.', Mandarin: '请使用至少 20 个字符描述模块。' },

  // AI module generator
  'ai.back': { English: 'Back to dashboard', Mandarin: '返回仪表盘' },
  'ai.title': { English: 'Create module with AI', Mandarin: '使用 AI 创建模块' },
  'ai.subtitle': { English: 'Configure the complete draft before generation. Nothing will be published automatically.', Mandarin: '生成前配置完整草稿。任何内容都不会自动发布。' },
  'ai.promptLabel': { English: 'Module instruction (Required)', Mandarin: '模块指令（必填）' },
  'ai.promptHelp': { English: 'Include the target audience, expected skills, context, and any important restrictions.', Mandarin: '请包含目标受众、预期技能、背景和重要限制。' },
  'ai.promptPlaceholder': { English: 'Create a complete onboarding module for new presales consultants. Cover discovery, qualification, solution mapping, demos, and handover...', Mandarin: '为新的售前顾问创建完整的入职模块，涵盖需求发现、资格评估、方案匹配、演示和交接……' },
  'ai.promptMinimum': { English: 'Minimum 20 characters', Mandarin: '至少 20 个字符' },
  'ai.depthLabel': { English: 'Number of lessons (1-10)', Mandarin: '课程数量（1-10）' },
  'ai.referencesLabel': { English: 'Reference files (Optional)', Mandarin: '参考文件（可选）' },
  'ai.referencesHelp': { English: 'PDF, DOCX, PPT, PPTX, TXT, PNG, or JPG. Up to 20 files and 25 MB each.', Mandarin: '支持 PDF、DOCX、PPT、PPTX、TXT、PNG 或 JPG。最多 20 个文件，每个 25 MB。' },
  'ai.chooseFiles': { English: 'Choose files', Mandarin: '选择文件' },
  'ai.unsupportedFile': { English: 'One or more selected files use an unsupported format.', Mandarin: '一个或多个所选文件的格式不受支持。' },
  'ai.fileTooLarge': { English: 'Each reference file must be 25 MB or smaller.', Mandarin: '每个参考文件不得超过 25 MB。' },
  'ai.tooManyFiles': { English: 'A generation request can contain at most 20 reference files.', Mandarin: '一次生成请求最多可包含 20 个参考文件。' },
  'ai.removeFile': { English: 'Remove', Mandarin: '移除' },
  'ai.noReferences': { English: 'No references selected. The model will use your instruction unless web research is enabled.', Mandarin: '未选择参考资料。除非启用网络研究，否则模型将使用您的指令。' },
  'ai.outputLanguage': { English: 'Output language', Mandarin: '输出语言' },
  'ai.researchOptions': { English: 'Research options', Mandarin: '研究选项' },
  'ai.webSearch': { English: 'Search the web', Mandarin: '搜索网络' },
  'ai.webSearchHelp': { English: 'Use current external sources and include citations.', Mandarin: '使用最新外部来源并包含引用。' },
  'ai.referenceVisuals': { English: 'Use visuals from references', Mandarin: '使用参考资料中的视觉内容' },
  'ai.referenceVisualsHelp': { English: 'Let the AI select relevant images or diagrams from uploaded files.', Mandarin: '允许 AI 从上传文件中选择相关图片或图表。' },
  'ai.reviewRequest': { English: 'Review generation request', Mandarin: '检查生成请求' },
  'ai.requestReady': { English: 'Request is valid', Mandarin: '请求有效' },
  'ai.referenceCount': { English: 'Reference files', Mandarin: '参考文件' },
  'ai.referencesUnavailable': { English: 'Reference ingestion arrives in Phase 8. Remove selected files to run the current fake-generation workflow.', Mandarin: '参考资料导入将在第 8 阶段提供。请移除所选文件以运行当前的模拟生成流程。' },
  'ai.startGeneration': { English: 'Start draft generation', Mandarin: '开始生成草稿' },
  'ai.submitting': { English: 'Starting...', Mandarin: '正在启动…' },
  'ai.statusQueued': { English: 'Generation queued', Mandarin: '生成任务已排队' },
  'ai.statusProcessing': { English: 'Generating module draft', Mandarin: '正在生成模块草稿' },
  'ai.statusCompleted': { English: 'Draft generation completed', Mandarin: '草稿生成完成' },
  'ai.statusFailed': { English: 'Generation failed', Mandarin: '生成失败' },
  'ai.statusCancelling': { English: 'Cancelling generation', Mandarin: '正在取消生成' },
  'ai.statusCancelled': { English: 'Generation cancelled', Mandarin: '生成已取消' },
  'ai.statusRequestFailed': { English: 'Generation could not start', Mandarin: '无法启动生成' },
  'ai.stageQueued': { English: 'Waiting for the generation worker.', Mandarin: '正在等待生成工作进程。' },
  'ai.stagePlanning': { English: 'Planning the module and lesson sequence.', Mandarin: '正在规划模块和课程顺序。' },
  'ai.stageCompleted': { English: 'A validated preview is ready for review.', Mandarin: '经过验证的预览已可供检查。' },
  'ai.stageFailed': { English: 'The worker stopped before producing a valid draft.', Mandarin: '工作进程在生成有效草稿之前停止。' },
  'ai.stageCancelling': { English: 'Finishing the active step, then discarding its result.', Mandarin: '正在完成当前步骤，随后将丢弃其结果。' },
  'ai.stageCancelled': { English: 'No generated result was retained.', Mandarin: '未保留任何生成结果。' },
  'ai.pollingDelayed': { English: 'The latest status could not be loaded. Retrying automatically.', Mandarin: '无法加载最新状态，正在自动重试。' },
  'ai.cancelGeneration': { English: 'Cancel generation', Mandarin: '取消生成' },
  'ai.cancellingAction': { English: 'Cancelling...', Mandarin: '正在取消…' },
  'ai.retryGeneration': { English: 'Retry generation', Mandarin: '重试生成' },
  'ai.draftPreview': { English: 'Generated draft preview', Mandarin: '生成的草稿预览' },
  'ai.presentationPlan': { English: 'Presentation plan', Mandarin: '演示文稿计划' },
  'ai.fakeGeneratorNotice': { English: 'This preview was produced by the deterministic fake generator. It used no model, web search, references, or credits, and it has not been saved to the LMS.', Mandarin: '此预览由确定性的模拟生成器创建。它未使用模型、网络搜索、参考资料或额度，也尚未保存到 LMS。' },

  // Course Management
  'courses.title': { English: 'Course Management', Mandarin: '课程管理' },
  'courses.subtitle': { English: 'Manage training modules you\'ve created', Mandarin: '管理您创建的培训模块' },
  'courses.sections': { English: 'sections', Mandarin: '个章节' },
  'courses.enrolled': { English: 'enrolled', Mandarin: '已注册' },
  'courses.published': { English: 'Published', Mandarin: '已发布' },
  'courses.draft': { English: 'Draft', Mandarin: '草稿' },
  'courses.publish': { English: 'Publish', Mandarin: '发布' },
  'courses.remove': { English: 'Remove', Mandarin: '删除' },
  'courses.noModules': { English: 'No training modules created yet', Mandarin: '尚未创建培训模块' },
  'courses.createFirst': { English: 'Create First Module', Mandarin: '创建第一个模块' },
  'courses.newModule': { English: 'New Module', Mandarin: '新建模块' },
  'courses.removing': { English: 'Removing...', Mandarin: '删除中...' },
  'courses.removeTitle': { English: 'Remove Module', Mandarin: '删除模块' },
  'courses.removeDesc': { English: 'Are you sure you want to remove "{title}"? This will permanently delete the module and all its sections. This action cannot be undone.', Mandarin: '确定要删除 "{title}" 吗？这将永久删除该模块及其所有章节。此操作无法撤销。' },

  // Create Course
  'create.title': { English: 'Create Training Module', Mandarin: '创建培训模块' },
  'create.editTitle': { English: 'Edit Training Module', Mandarin: '编辑培训模块' },
  'create.moduleCover': { English: 'Module Cover', Mandarin: '模块封面' },
  'create.moduleTitle': { English: 'Module Title', Mandarin: '模块标题' },
  'create.titlePlaceholder': { English: 'e.g. Workplace Safety Fundamentals', Mandarin: '例如：工作场所安全基础' },
  'create.save': { English: 'Save Module', Mandarin: '保存模块' },
  'create.saved': { English: 'Module Saved', Mandarin: '模块已保存' },
  'create.update': { English: 'Update Module', Mandarin: '更新模块' },
  'create.publish': { English: 'Publish to Catalog', Mandarin: '发布到目录' },
  'create.publishing': { English: 'Publishing...', Mandarin: '发布中...' },
  'create.removeModule': { English: 'Remove Module', Mandarin: '删除模块' },
  'create.lessonSections': { English: 'Lesson Sections', Mandarin: '课程章节' },
  'create.addSection': { English: 'Add Section', Mandarin: '添加章节' },
  'create.noSections': { English: 'No sections yet', Mandarin: '暂无章节' },
  'create.noSectionsDesc': { English: 'Click "Add Section" to create a lesson and attach at least one presentation', Mandarin: '点击“添加章节”创建课程，并至少附加一个演示文稿' },
  'create.saveFirst': { English: 'Save the module first', Mandarin: '请先保存模块' },
  'create.saveFirstDesc': { English: 'Then you can add lesson sections and presentation files', Mandarin: '然后您可以添加课程章节和演示文稿文件' },
  'create.back': { English: 'Back', Mandarin: '返回' },
  'create.uploadCover': { English: 'Click to upload cover image', Mandarin: '点击上传封面图片' },
  'create.coverSize': { English: 'Recommended: 1920×1080', Mandarin: '建议尺寸：1920×1080' },
  'create.updateModule': { English: 'Update Module', Mandarin: '更新模块' },
  'create.enterTitle': { English: 'Please enter a module title', Mandarin: '请输入模块标题' },
  'create.failedSave': { English: 'Failed to save module. Please try again.', Mandarin: '保存模块失败，请重试。' },
  'create.failedUpdate': { English: 'Failed to update. Please try again.', Mandarin: '更新失败，请重试。' },

  // Add Section Modal
  'addSection.title': { English: 'Add Section', Mandarin: '添加章节' },
  'addSection.editTitle': { English: 'Edit Section', Mandarin: '编辑章节' },
  'addSection.sectionName': { English: 'Section Name', Mandarin: '章节名称' },
  'addSection.sectionNameRequired': { English: 'Section Name (Required)', Mandarin: '章节名称（必填）' },
  'addSection.description': { English: 'Lesson Description', Mandarin: '课程描述' },
  'addSection.descriptionRequiredLabel': { English: 'Lesson Description (Required)', Mandarin: '课程描述（必填）' },
  'addSection.descriptionPlaceholder': { English: 'Describe what learners will learn in this lesson', Mandarin: '描述学员将在本课程中学到什么' },
  'addSection.pptSlides': { English: 'Presentation Files (Required)', Mandarin: '演示文稿文件（必填）' },
  'addSection.cancel': { English: 'Cancel', Mandarin: '取消' },
  'addSection.addSection': { English: 'Add Section', Mandarin: '添加章节' },
  'addSection.saveChanges': { English: 'Save Changes', Mandarin: '保存更改' },
  'addSection.sectionPlaceholder': { English: 'e.g. Introduction to Data Privacy', Mandarin: '例如：数据隐私简介' },
  'addSection.clickUploadPpt': { English: 'Click or drop presentation files', Mandarin: '点击或拖放演示文稿文件' },
  'addSection.clickUploadNewPpt': { English: 'Add more presentation files', Mandarin: '添加更多演示文稿文件' },
  'addSection.pptInfoOptional': { English: 'At least 1 file · Up to 10 · Max 200MB each', Mandarin: '至少 1 个文件 · 最多 10 个 · 每个最大 200MB' },
  'addSection.uploadHint': { English: 'Learners can download every attached presentation.', Mandarin: '学员可以下载每个附加的演示文稿。' },
  'addSection.editUploadHint': { English: 'Add or remove presentation files, then save the lesson.', Mandarin: '添加或删除演示文稿文件，然后保存课程。' },
  'addSection.presentationFiles': { English: 'files attached', Mandarin: '个附件' },
  'addSection.existingPresentation': { English: 'Existing attachment', Mandarin: '现有附件' },
  'addSection.removePresentation': { English: 'Remove presentation', Mandarin: '删除演示文稿' },
  'addSection.tooManyPresentations': { English: 'A lesson can contain at most 10 presentation files', Mandarin: '一节课程最多可包含 10 个演示文稿文件' },
  'addSection.presentationRequired': { English: 'Upload at least one presentation file before saving the lesson', Mandarin: '保存课程前请至少上传一个演示文稿文件' },
  'addSection.descriptionRequired': { English: 'Enter a lesson description before saving the lesson', Mandarin: '保存课程前请输入课程描述' },
  'addSection.saving': { English: 'Saving...', Mandarin: '保存中...' },
  'addSection.enterSectionName': { English: 'Please enter a section name', Mandarin: '请输入章节名称' },
  'addSection.failedUpdate': { English: 'Failed to update section', Mandarin: '更新章节失败' },
  'addSection.failedAdd': { English: 'Failed to add section', Mandarin: '添加章节失败' },
  'addSection.fileSizeLimit': { English: 'File size must not exceed 200MB', Mandarin: '文件大小不能超过 200MB' },
  'addSection.acceptedFiles': { English: 'Only PDF, PPT, and PPTX files are accepted', Mandarin: '仅支持 PDF、PPT 和 PPTX 文件' },

  // Course Detail
  'detail.back': { English: 'Back', Mandarin: '返回' },
  'detail.dashboard': { English: 'Dashboard', Mandarin: '仪表盘' },
  'detail.catalog': { English: 'Catalog', Mandarin: '目录' },
  'detail.lessons': { English: 'Lessons', Mandarin: '课程' },
  'detail.enrolled': { English: 'Enrolled', Mandarin: '已注册' },
  'detail.progress': { English: 'Progress', Mandarin: '进度' },
  'detail.lessonsCompleted': { English: 'lessons completed', Mandarin: '个课程已完成' },
  'detail.startTraining': { English: 'Start Training', Mandarin: '开始培训' },
  'detail.starting': { English: 'Starting...', Mandarin: '启动中...' },
  'detail.continueTraining': { English: 'Continue Training', Mandarin: '继续培训' },
  'detail.instructorView': { English: 'Instructor View', Mandarin: '讲师视图' },
  'detail.moduleCompleted': { English: 'Module Completed', Mandarin: '模块已完成' },
  'detail.moduleContent': { English: 'Module Content', Mandarin: '模块内容' },
  'detail.startLesson': { English: 'Start Lesson', Mandarin: '开始课程' },
  'detail.viewLesson': { English: 'View Lesson', Mandarin: '查看课程' },
  'detail.reviewLesson': { English: 'Review Lesson', Mandarin: '复习课程' },
  'detail.employeeProgress': { English: 'Employee Progress', Mandarin: '员工进度' },
  'detail.hideProgress': { English: 'Hide Progress', Mandarin: '隐藏进度' },
  'detail.presentations': { English: 'presentations', Mandarin: '个演示文稿' },
  'detail.completed': { English: 'Completed', Mandarin: '已完成' },
  'detail.locked': { English: 'Locked', Mandarin: '已锁定' },
  'detail.completePreviousFirst': { English: 'Complete previous first', Mandarin: '请先完成上一课' },
  'detail.noEmployeeEnrollments': { English: 'No employee enrollments yet', Mandarin: '暂无员工注册' },
  'detail.generalTraining': { English: 'General Training', Mandarin: '通用培训' },

  // Classroom
  'classroom.deck': { English: 'Deck', Mandarin: '演示文稿' },
  'classroom.decks': { English: 'decks', Mandarin: '个演示文稿' },
  'classroom.previous': { English: 'Previous', Mandarin: '上一课' },
  'classroom.nextLesson': { English: 'Next Lesson', Mandarin: '下一课' },
  'classroom.finish': { English: 'Finish', Mandarin: '完成' },
  'classroom.finishing': { English: 'Finishing...', Mandarin: '完成中...' },
  'classroom.completePreviousFirst': { English: 'Complete Previous First', Mandarin: '请先完成上一课' },
  'classroom.backToModule': { English: 'Back to Module', Mandarin: '返回模块' },
  'classroom.moduleCompleted': { English: 'Module Completed!', Mandarin: '模块已完成！' },
  'classroom.completedMsg': { English: 'You have finished all lessons in this module.', Mandarin: '您已完成此模块的所有课程。' },
  'classroom.noPresentations': { English: 'No presentation attached', Mandarin: '未附加演示文稿' },
  'classroom.noPresentationsDescription': { English: 'This legacy lesson has no uploaded presentation. Ask the instructor to attach one.', Mandarin: '此旧课程没有上传的演示文稿。请讲师添加文件。' },
  'classroom.downloadPresentation': { English: 'Download', Mandarin: '下载' },
  'classroom.preparingSlides': { English: 'Preparing slides...', Mandarin: '正在准备幻灯片...' },
  'classroom.previewFailed': { English: 'This slide deck could not be previewed.', Mandarin: '无法预览此演示文稿。' },
  'classroom.previousSlide': { English: 'Previous slide', Mandarin: '上一张幻灯片' },
  'classroom.nextSlide': { English: 'Next slide', Mandarin: '下一张幻灯片' },
  'classroom.viewMode': { English: 'View Mode', Mandarin: '查看模式' },

  // My Learning
  'learning.title': { English: 'My Training', Mandarin: '我的培训' },
  'learning.subtitle': { English: 'Track your assigned and enrolled training modules', Mandarin: '跟踪您分配和注册的培训模块' },
  'learning.enrolled': { English: 'Enrolled', Mandarin: '已注册' },
  'learning.inProgress': { English: 'In Progress', Mandarin: '进行中' },
  'learning.completed': { English: 'Completed', Mandarin: '已完成' },
  'learning.bookmarked': { English: 'Bookmarked', Mandarin: '已收藏' },
  'learning.avgProgress': { English: 'Avg Progress', Mandarin: '平均进度' },
  'learning.noActiveTraining': { English: 'No active training', Mandarin: '没有进行中的培训' },
  'learning.noCompletedTraining': { English: 'No completed training', Mandarin: '没有已完成的培训' },
  'learning.noBookmarkedTraining': { English: 'No bookmarked training', Mandarin: '没有已收藏的培训' },
  'learning.browseCatalog': { English: 'Browse the catalog to enroll in training modules', Mandarin: '浏览目录以注册培训模块' },
  'learning.completeToSee': { English: 'Complete a module to see it here', Mandarin: '完成模块后在此查看' },
  'learning.bookmarkToFind': { English: 'Bookmark modules to find them easily', Mandarin: '收藏模块以便快速查找' },

  // Catalog
  'catalog.title': { English: 'Training Catalog', Mandarin: '培训目录' },
  'catalog.subtitle': { English: 'Browse all available training modules', Mandarin: '浏览所有可用的培训模块' },
  'catalog.searchPlaceholder': { English: 'Search from the first letter...', Mandarin: '从标题首字母开始搜索...' },
  'catalog.showing': { English: 'Showing', Mandarin: '显示' },
  'catalog.modules': { English: 'modules', Mandarin: '个模块' },
  'catalog.in': { English: 'in', Mandarin: '分类' },
  'catalog.noCategoryModules': { English: 'No modules in this category', Mandarin: '此分类下没有模块' },
  'catalog.noMatchSearch': { English: 'No modules match your search', Mandarin: '没有匹配搜索的模块' },
  'catalog.newest': { English: 'Newest', Mandarin: '最新' },
  'catalog.mostEnrolled': { English: 'Most Enrolled', Mandarin: '最多注册' },
  'catalog.az': { English: 'A–Z', Mandarin: 'A–Z' },

  // Profile
  'profile.trainingOverview': { English: 'Training Overview', Mandarin: '培训概览' },
  'profile.modulesEnrolled': { English: 'Modules Enrolled', Mandarin: '已注册模块' },
  'profile.completed': { English: 'Completed', Mandarin: '已完成' },
  'profile.inProgress': { English: 'In Progress', Mandarin: '进行中' },
  'profile.completion': { English: 'Completion', Mandarin: '完成率' },
  'profile.quickActions': { English: 'Quick Actions', Mandarin: '快捷操作' },
  'profile.account': { English: 'Account', Mandarin: '账户' },
  'profile.accountSettings': { English: 'Account Settings', Mandarin: '账户设置' },
  'profile.email': { English: 'Email', Mandarin: '邮箱' },
  'profile.displayName': { English: 'Display Name', Mandarin: '显示名称' },
  'profile.role': { English: 'Role', Mandarin: '角色' },
  'profile.instructor': { English: 'Instructor', Mandarin: '讲师' },
  'profile.employee': { English: 'Employee', Mandarin: '员工' },
  'profile.admin': { English: 'Admin', Mandarin: '管理员' },
  'profile.saveChanges': { English: 'Save Changes', Mandarin: '保存更改' },
  'profile.saving': { English: 'Saving...', Mandarin: '保存中...' },
  'profile.signOut': { English: 'Sign Out', Mandarin: '退出登录' },
  'profile.readOnly': { English: 'Read only', Mandarin: '只读' },
  'profile.fixedByAdmin': { English: 'Fixed by admin', Mandarin: '由管理员设置' },
  'profile.myTraining': { English: 'My Training', Mandarin: '我的培训' },
  'profile.viewEnrolled': { English: 'View enrolled modules', Mandarin: '查看已注册模块' },
  'profile.newModule': { English: 'New Module', Mandarin: '新建模块' },
  'profile.createContent': { English: 'Create training content', Mandarin: '创建培训内容' },
  'profile.userManagement': { English: 'User Management', Mandarin: '用户管理' },
  'profile.viewManageUsers': { English: 'View and manage users', Mandarin: '查看和管理用户' },
  'profile.nameUpdated': { English: 'Name updated successfully', Mandarin: '名称更新成功' },
  'profile.nameEmpty': { English: 'Name cannot be empty', Mandarin: '名称不能为空' },
  'profile.failedUpdate': { English: 'Failed to update. Please try again.', Mandarin: '更新失败，请重试。' },
  'profile.enterName': { English: 'Enter your name', Mandarin: '输入您的名称' },

  // Admin
  'admin.userManagement': { English: 'User Management', Mandarin: '用户管理' },
  'admin.allUsers': { English: 'All Users', Mandarin: '所有用户' },
  'admin.editUser': { English: 'Edit User', Mandarin: '编辑用户' },
  'admin.name': { English: 'Name', Mandarin: '姓名' },
  'admin.role': { English: 'Role', Mandarin: '角色' },
  'admin.actions': { English: 'Actions', Mandarin: '操作' },
  'admin.save': { English: 'Save', Mandarin: '保存' },
  'admin.cancel': { English: 'Cancel', Mandarin: '取消' },
  'admin.email': { English: 'Email', Mandarin: '邮箱' },
  'admin.coursesCreated': { English: 'Courses Created', Mandarin: '已创建课程' },
  'admin.enrollments': { English: 'Enrollments', Mandarin: '注册数' },
  'admin.createdDate': { English: 'Created Date', Mandarin: '创建日期' },
  'admin.searchUsers': { English: 'Search users by name or email...', Mandarin: '按姓名或邮箱搜索用户...' },
  'admin.noUsers': { English: 'No users found', Mandarin: '未找到用户' },
  'admin.editName': { English: 'Display Name', Mandarin: '显示名称' },
  'admin.editRole': { English: 'User Role', Mandarin: '用户角色' },
  'admin.selectRole': { English: 'Select role...', Mandarin: '选择角色...' },
  'admin.editDescription': { English: 'Update user name and/or role', Mandarin: '更新用户姓名和/或角色' },
  'admin.saving': { English: 'Saving...', Mandarin: '保存中...' },
  'admin.manageUsers': { English: 'Manage Users', Mandarin: '管理用户' },
  'admin.manageUsersDesc': { English: 'View and manage platform users', Mandarin: '查看和管理平台用户' },
  'admin.userCount': { English: '{count} users', Mandarin: '{count} 个用户' },
  'admin.singleUserCount': { English: '{count} user', Mandarin: '{count} 个用户' },
  'admin.enterDisplayName': { English: 'Enter display name', Mandarin: '输入显示名称' },
  'admin.nameEmpty': { English: 'Name cannot be empty', Mandarin: '名称不能为空' },
  'admin.failedUpdate': { English: 'Failed to update. Please try again.', Mandarin: '更新失败，请重试。' },

  // CourseCard
  'card.lessons': { English: 'lessons', Mandarin: '个课程' },
  'card.enrolled': { English: 'enrolled', Mandarin: '已注册' },
  'card.required': { English: 'Required', Mandarin: '必修' },
  'card.viewDetails': { English: 'View Details', Mandarin: '查看详情' },
  'card.bookmark': { English: 'Bookmark', Mandarin: '收藏' },
  'card.bookmarked': { English: 'Bookmarked', Mandarin: '已收藏' },
  'card.addBookmark': { English: 'Add to bookmarks', Mandarin: '添加到收藏' },
  'card.removeBookmark': { English: 'Remove from bookmarks', Mandarin: '从收藏中移除' },
  'card.complete': { English: '{pct}% complete', Mandarin: '{pct}% 已完成' },

  // Common
  'common.all': { English: 'All', Mandarin: '全部' },
  'common.popular': { English: 'Popular', Mandarin: '热门' },
  'common.recent': { English: 'Recent', Mandarin: '最近' },
  'common.startHere': { English: 'Start here', Mandarin: '从这里开始' },
  'common.required': { English: 'Required', Mandarin: '必修' },
  'common.lessons': { English: 'lessons', Mandarin: '个课程' },
  'common.notFound': { English: 'Module not found', Mandarin: '模块未找到' },

  // Description template
  'desc.learnAbout': { English: 'Learn about', Mandarin: '了解' },
  'desc.inThisModule': { English: 'in this comprehensive training module.', Mandarin: '的全面培训模块。' },

  // Error messages
  'error.serverError': { English: 'Server error. Please try again.', Mandarin: '服务器错误，请重试。' },
  'error.unexpected': { English: 'An unexpected error occurred', Mandarin: '发生意外错误' },
  'error.failedPublish': { English: 'Failed to publish', Mandarin: '发布失败' },
}

// Category translations (from database values)
const categoryMap: Record<string, Record<Lang, string>> = {
  'General Training': { English: 'General Training', Mandarin: '通用培训' },
  'Safety & Compliance': { English: 'Safety & Compliance', Mandarin: '安全与合规' },
  'Leadership & Management': { English: 'Leadership & Management', Mandarin: '领导与管理' },
  'Technical & Engineering': { English: 'Technical & Engineering', Mandarin: '技术与工程' },
  'Sales & Marketing': { English: 'Sales & Marketing', Mandarin: '销售与市场' },
  'Finance & Accounting': { English: 'Finance & Accounting', Mandarin: '财务与会计' },
  'Human Resources': { English: 'Human Resources', Mandarin: '人力资源' },
  'Operations & Logistics': { English: 'Operations & Logistics', Mandarin: '运营与物流' },
  'Product & Design': { English: 'Product & Design', Mandarin: '产品与设计' },
  'Business Knowledge': { English: 'Business Knowledge', Mandarin: '商业知识' },
  'DIY Course': { English: 'DIY Course', Mandarin: 'DIY 课程' },
  'Life Skills': { English: 'Life Skills', Mandarin: '生活技能' },
  'Subject Education': { English: 'Subject Education', Mandarin: '学科教育' },
}

// Department tag translations
const deptMap: Record<string, Record<Lang, string>> = {
  'Engineering': { English: 'Engineering', Mandarin: '工程部' },
  'Operations': { English: 'Operations', Mandarin: '运营部' },
  'Compliance': { English: 'Compliance', Mandarin: '合规部' },
  'HR': { English: 'HR', Mandarin: '人事部' },
  'Finance': { English: 'Finance', Mandarin: '财务部' },
  'Sales': { English: 'Sales', Mandarin: '销售部' },
  'General': { English: 'General', Mandarin: '综合' },
}

export function t9(key: string, lang: Lang): string {
  return t[key]?.[lang] || t[key]?.English || key
}

// Interpolate {var} placeholders
export function t9i(key: string, lang: Lang, vars: Record<string, string | number>): string {
  let str = t9(key, lang)
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v))
  }
  return str
}

// Translate a category name from the database
export function translateCategory(name: string, lang: Lang): string {
  return categoryMap[name]?.[lang] || name
}

// Translate a department tag
export function translateDept(name: string, lang: Lang): string {
  return deptMap[name]?.[lang] || name
}

// Translate course description (handles the "Learn about X in this comprehensive training module." pattern)
export function translateDescription(desc: string, lang: Lang): string {
  if (lang !== 'Mandarin') return desc
  const match = desc.match(/^Learn about (.+) in this comprehensive training module\.$/)
  if (match) {
    return `了解${match[1]}的全面培训模块。`
  }
  return desc
}

// Format date based on language
export function formatDate(isoString: string, lang: Lang): string {
  const date = new Date(isoString)
  if (lang === 'Mandarin') {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }
  return date.toLocaleDateString()
}
