# TUSOME Analytics API Reference

Generated: 2026-11-01T12:31:49.750Z

Total functions: 228
Total types: 116

## Functions

| Function | Parameters | Return Type |
|----------|-----------|-------------|
| `getClassPerformance` | examId: string, classId?: string, streamId?: string, options: RequestOptions = {} | ClassPerformanceStudent[] |
| `getGradeDistribution` | examId: string, classId?: string, streamId?: string, options: RequestOptions = {} | GradeDistribution[] |
| `getSubjectPerformance` | examId: string, classId?: string, streamId?: string, options: RequestOptions = {} | SubjectPerformance[] |
| `getStudentReportData` | studentId: string, examId: string, options: RequestOptions = {} | StudentReportData |
| `getAnalyticsFilters` | options: RequestOptions = {} | AnalyticsFilterOptions |
| `getMarkSheet` | examId: string, classId?: string, streamId?: string, options: RequestOptions = {} | MarkSheetRow[] |
| `getStudentExamHistory` | studentId: string, options: RequestOptions = {} | StudentExamHistoryRow[] |
| `getMostImproved` | examId: string, classId?: string, streamId?: string, options: RequestOptions = {} | MostImprovedRow[] |
| `getAccountDirectory` | options: RequestOptions = {} | AccountDirectoryRow[] |
| `getPermissionCatalogue` | options: RequestOptions = {} | PermissionCatalogueItem[] |
| `getRolesWithPermissions` | options: RequestOptions = {} | RoleWithPermissionsRow[] |
| `upsertCustomRole` | input: UpsertCustomRoleInput, options: RequestOptions = {} | string |
| `deleteCustomRole` | roleKey: string, options: RequestOptions = {} | boolean |
| `getUserPermissionProfile` | userId: string, options: RequestOptions = {} | UserPermissionProfile |
| `saveUserPermissionOverrides` | input: SaveUserPermissionOverridesInput, options: RequestOptions = {} | UserPermissionProfile |
| `setUserAccessRevoked` | userId: string, revoked: boolean, options: RequestOptions = {} | boolean |
| `inviteOrCreateAccount` | input: InviteOrCreateAccountInput, options: RequestOptions = {} | string |
| `updateAccountProfile` | input: UpdateAccountProfileInput, options: RequestOptions = {} | boolean |
| `getSectionHeads` | options: RequestOptions = {} | SectionHeadRow[] |
| `upsertSectionHead` | formLevel: string, userId: string, options: RequestOptions = {} | string |
| `deleteSectionHead` | sectionHeadId: string, options: RequestOptions = {} | boolean |
| `getExamSetupOptions` | options: RequestOptions = {} | ExamSetupOptions |
| `getExamPipelineOverview` | options: RequestOptions = {} | ExamPipelineRow[] |
| `createExam` | input: CreateExamInput, options: RequestOptions = {} | string |
| `getExamMarkEntryRoster` | examId: string, subjectId: string, classId?: string, streamId?: string, options: RequestOptions = {} | ExamMarkEntryRow[] |
| `saveExamSubjectMarks` | examId: string, subjectId: string, entries: MarkEntrySubmissionItem[], options: RequestOptions = {} | number |
| `getExamPublishReadiness` | examId: string, options: RequestOptions = {} | ExamPublishReadinessRow[] |
| `getSubjectPublishStatus` | examId: string, options: RequestOptions = {} | SubjectPublishStatusRow[] |
| `publishSubject` | examId: string, subjectId: string, published: boolean, options: RequestOptions = {} | boolean |
| `grantSubjectTeacherAccess` | examId: string, subjectId: string, teacherId: string, options: RequestOptions = {} | boolean |
| `revokeSubjectTeacherAccess` | examId: string, subjectId: string, teacherId: string, options: RequestOptions = {} | boolean |
| `setExamLifecycleStatus` | examId: string, status: ExamLifecycleStatus, options: RequestOptions = {} | boolean |
| `getTeacherDirectory` | options: RequestOptions = {} | TeacherDirectoryRow[] |
| `upsertTeacherProfile` | input: UpsertTeacherProfileInput, options: RequestOptions = {} | string |
| `getStaffGroups` | options: RequestOptions = {} | StaffGroupRow[] |
| `upsertStaffGroup` | name: string, staffType: StaffType = 'TEACHER', options: RequestOptions = {} | string |
| `deleteStaffGroup` | groupId: string, options: RequestOptions = {} | boolean |
| `getTeacherAllocations` | academicYear?: number, options: RequestOptions = {} | TeacherAllocationRow[] |
| `upsertTeacherAllocation` | input: UpsertTeacherAllocationInput, options: RequestOptions = {} | string |
| `deleteTeacherAllocation` | allocationType: TeacherAllocationType, allocationId: string, options: RequestOptions = {} | boolean |
| `getTeacherSubjectClassPerformance` | examId: string, teacherId?: string, options: RequestOptions = {} | TeacherSubjectClassPerformanceRow[] |
| `getStudentDirectory` | search?: string, classId?: string, streamId?: string, limit?: number, options: RequestOptions = {} | StudentDirectoryRow[] |
| `getStudentProfile` | studentId: string, options: RequestOptions = {} | StudentProfileData |
| `createStudent` | admissionNo: string, fullName: string, gender?: string, classId?: string, streamId?: string, academicYear?: number, options: RequestOptions = {} | string |
| `updateStudentProfile` | studentId: string, admissionNo?: string, fullName?: string, gender?: string, classId?: string, streamId?: string, options: RequestOptions = {} | boolean |
| `moveStudent` | studentId: string, action: string, destinationClassId?: string, destinationStreamId?: string, academicYear?: number, options: RequestOptions = {} | boolean |
| `getSchoolProfile` | options: RequestOptions = {} | SchoolProfile |
| `updateSchoolProfile` | input: { name?: string; schoolType?: string; country?: string; region?: string; county?: string; educationSystem?: string; ownershipType?: string; contactPerson?: string; contactPhone?: string; contactEmail?: string; watermarkUrl?: string; logoUrl?: string; motto?: string; }, options: RequestOptions = {} | boolean |
| `getSchoolValidity` | options: RequestOptions = {} | SchoolValidity |
| `getTermDates` | academicYear?: number, term?: string, options: RequestOptions = {} | TermDateRow[] |
| `upsertTermDate` | academicYear: number, term: string, openingDate: string, closingDate: string, options: RequestOptions = {} | string |
| `getReportTemplateConfig` | options: RequestOptions = {} | ReportTemplateConfig[] |
| `setReportTemplateConfig` | configKey: string, configValue: string, options: RequestOptions = {} | boolean |
| `logMessage` | recipientType: string, recipientIds: string[], messageType: string, subject: string | null, messageBody: string, phoneNumbers: string[], recipientCount: number, creditsUsed: number, examId?: string, options: RequestOptions = {} | string |
| `getMessageHistory` | limit?: number, options: RequestOptions = {} | MessageLogRow[] |
| `getMessageRecipients` | options: RequestOptions = {} | MessageRecipients |
| `getPendingSms` | options: RequestOptions = {} | PendingSmsRow[] |
| `updateSmsStatus` | messageId: string, status: string, options: RequestOptions = {} | boolean |
| `getSmsGatewayConfig` | options: RequestOptions = {} | SmsGatewayConfig |
| `getAttendanceForExam` | examId: string, options: RequestOptions = {} | AttendanceRow[] |
| `saveAttendanceForExam` | examId: string, entries: Array<{ student_id: string; status: string; remarks?: string }>, options: RequestOptions = {} | void |
| `getBehaviourForStudent` | studentId: string, options: RequestOptions = {} | BehaviourRow[] |
| `addStudentNote` | studentId: string, noteType: string, title: string, content: string, options: RequestOptions = {} | string |
| `deleteStudentNote` | noteId: string, options: RequestOptions = {} | void |
| `getStudentGroups` | options: RequestOptions = {} | StudentGroup[] |
| `upsertStudentGroup` | name: string, description?: string, options: RequestOptions = {} | string |
| `assignStudentToGroup` | studentId: string, groupId: string, options: RequestOptions = {} | void |
| `getStudentResidences` | options: RequestOptions = {} | StudentResidence[] |
| `upsertStudentResidence` | name: string, residenceType?: string, capacity?: number, supervisorId?: string, options: RequestOptions = {} | string |
| `assignStudentResidence` | studentId: string, residenceId: string, options: RequestOptions = {} | void |
| `getSubjectPapers` | subjectId: string, options: RequestOptions = {} | SubjectPaper[] |
| `upsertSubjectPaper` | subjectId: string, name: string, code?: string, maxMarks?: number, weight?: number, sortOrder?: number, options: RequestOptions = {} | string |
| `getPathways` | options: RequestOptions = {} | Pathway[] |
| `upsertPathway` | name: string, track?: string, description?: string, options: RequestOptions = {} | string |
| `assignStudentPathway` | studentId: string, pathwayId: string, options: RequestOptions = {} | void |
| `getFeeStructures` | academicYear?: number, term?: string, options: RequestOptions = {} | FeeStructure[] |
| `upsertFeeStructure` | classId: string | null, academicYear: number, term: string, name: string, amount: number, description?: string, isActive?: boolean, options: RequestOptions = {} | string |
| `getStudentFeeBalance` | studentId: string, options: RequestOptions = {} | FeeBalance |
| `recordFeePayment` | studentId: string, amount: number, paymentMethod: string, referenceNumber?: string, academicYear?: number, term?: string, notes?: string, idempotencyKey?: string, options: RequestOptions = {} | string |
| `getFeePayments` | studentId?: string, limit?: number, options: RequestOptions = {} | FeePayment[] |
| `getFeePledges` | studentId?: string, options: RequestOptions = {} | FeePledge[] |
| `createFeePledge` | studentId: string, pledgedAmount: number, dueDate?: string, notes?: string, options: RequestOptions = {} | string |
| `getTimetable` | classId?: string, teacherId?: string, options: RequestOptions = {} | TimetableEntry[] |
| `saveTimetableEntry` | slotId: string, classId?: string, streamId?: string, subjectId?: string, teacherId?: string, room?: string, notes?: string, options: RequestOptions = {} | { success: boolean; entry_id?: string; conflicts: unknown[]; message: string } |
| `upsertTimetableSlot` | dayOfWeek: number, periodNumber: number, startTime: string, endTime: string, label?: string, options: RequestOptions = {} | string |
| `getEvents` | startDate?: string, endDate?: string, options: RequestOptions = {} | EventRow[] |
| `createEvent` | title: string, description?: string, eventType?: string, startDate?: string, endDate?: string, location?: string, isAllDay?: boolean, options: RequestOptions = {} | string |
| `getNotices` | targetAudience?: string, options: RequestOptions = {} | NoticeRow[] |
| `createNotice` | title: string, content: string, noticeType?: string, targetAudience?: string, isPublished?: boolean, expiresAt?: string, options: RequestOptions = {} | string |
| `getClassesWithStreams` | options: RequestOptions = {} | ClassWithStreams[] |
| `upsertClass` | name: string, classId?: string, options: RequestOptions = {} | string |
| `upsertStream` | classId: string, name: string, streamId?: string, options: RequestOptions = {} | string |
| `getSubjectsWithDetails` | options: RequestOptions = {} | SubjectWithDetails[] |
| `upsertSubject` | name: string, code?: string, department?: string, isCompulsory?: boolean, subjectId?: string, options: RequestOptions = {} | string |
| `getStaffDirectory` | staffType?: string, options: RequestOptions = {} | StaffDirectoryRow[] |
| `upsertStaffProfile` | fullName: string, email?: string, role?: string, staffType?: string, isActive?: boolean, staffId?: string, options: RequestOptions = {} | string |
| `getCounsellingSessions` | studentId?: string, options: RequestOptions = {} | CounsellingSession[] |
| `createCounsellingSession` | studentId?: string, sessionType?: string, topic?: string, notes?: string, sessionDate?: string, outcome?: string, followUpDate?: string, options: RequestOptions = {} | string |
| `getCounsellingReferrals` | studentId?: string, options: RequestOptions = {} | CounsellingReferral[] |
| `createCounsellingReferral` | studentId: string, reason: string, urgency?: string, notes?: string, options: RequestOptions = {} | string |
| `getMedicalVisits` | studentId?: string, options: RequestOptions = {} | MedicalVisit[] |
| `createMedicalVisit` | studentId?: string, complaint?: string, diagnosis?: string, treatment?: string, referredTo?: string, status?: string, notes?: string, options: RequestOptions = {} | string |
| `getMedicalInventory` | options: RequestOptions = {} | MedicalInventoryItem[] |
| `getParentStudentLinks` | studentId?: string, parentId?: string, options: RequestOptions = {} | ParentStudentLink[] |
| `linkParentStudent` | parentId: string, studentId: string, relationship?: string, isPrimary?: boolean, options: RequestOptions = {} | string |
| `unlinkParentStudent` | linkId: string, options: RequestOptions = {} | boolean |
| `getParents` | options: RequestOptions = {} | ParentRow[] |
| `getOpportunities` | activeOnly?: boolean, options: RequestOptions = {} | Opportunity[] |
| `createOpportunity` | title: string, description?: string, opportunityType?: string, eligibilityCriteria?: string, deadline?: string, applicationUrl?: string, options: RequestOptions = {} | string |
| `applyForOpportunity` | opportunityId: string, studentId: string, notes?: string, options: RequestOptions = {} | string |
| `getOpportunityApplications` | opportunityId?: string, options: RequestOptions = {} | OpportunityApplication[] |
| `getExamComments` | examId?: string, studentId?: string, options: RequestOptions = {} | ExamComment[] |
| `addExamComment` | examId?: string, studentId?: string, commentText?: string, commentType?: string, targetType?: string, targetId?: string, categoryId?: string, options: RequestOptions = {} | string |
| `getCommentCategories` | categoryType?: string, options: RequestOptions = {} | CommentCategory[] |
| `getInvoices` | status?: string, options: RequestOptions = {} | Invoice[] |
| `createInvoice` | invoiceNumber: string, studentId?: string, amount?: number, taxAmount?: number, dueDate?: string, notes?: string, options: RequestOptions = {} | string |
| `getReceipts` | invoiceId?: string, options: RequestOptions = {} | Receipt[] |
| `recordReceipt` | invoiceId: string, receiptNumber: string, amountPaid: number, paymentMethod?: string, referenceNumber?: string, options: RequestOptions = {} | string |
| `getWallet` | ownerId: string, options: RequestOptions = {} | Wallet |
| `createWalletTransaction` | ownerId: string, transactionType: string, amount: number, description?: string, referenceNumber?: string, paymentMethod?: string, options: RequestOptions = {} | string |
| `getWalletTransactions` | ownerId: string, limit?: number, options: RequestOptions = {} | WalletTransaction[] |
| `getVoteHeads` | options: RequestOptions = {} | VoteHead[] |
| `upsertVoteHead` | name: string, code?: string, categoryId?: string, description?: string, voteHeadId?: string, options: RequestOptions = {} | string |
| `getVoteHeadCategories` | options: RequestOptions = {} | VoteHeadCategory[] |
| `getStudentVoteHeadBalances` | studentId: string, options: RequestOptions = {} | StudentVoteHeadBalance[] |
| `recordFeeCollection` | studentId: string, amount: number, collectionType?: string, voteHeadId?: string, paymentMethod?: string, referenceNumber?: string, academicYear?: number, term?: string, options: RequestOptions = {} | string |
| `getFeeCollections` | studentId?: string, limit?: number, options: RequestOptions = {} | FeeCollection[] |
| `getReversalReasons` | options: RequestOptions = {} | ReversalReason[] |
| `getFeeStructureGroups` | options: RequestOptions = {} | FeeStructureGroup[] |
| `upsertFeeStructureGroup` | name: string, description?: string, options: RequestOptions = {} | string |
| `getChartOfAccounts` | options: RequestOptions = {} | ChartOfAccount[] |
| `upsertChartOfAccount` | code: string, name: string, accountType: string, parentId?: string, description?: string, accountId?: string, options: RequestOptions = {} | string |
| `createJournalEntry` | entryDate: string, description: string, reference?: string, sourceType?: string, sourceId?: string, lines?: Array<{ account_id: string; debit: number; credit: number; description?: string }>, options: RequestOptions = {} | string |
| `postJournalEntry` | entryId: string, options: RequestOptions = {} | boolean |
| `getTrialBalance` | asOfDate?: string, options: RequestOptions = {} | TrialBalanceRow[] |
| `recordCashBookEntry` | entryType: string, amount: number, description: string, accountId?: string, referenceNumber?: string, paymentMethod?: string, entryDate?: string, options: RequestOptions = {} | string |
| `getCashBookEntries` | limit?: number, options: RequestOptions = {} | CashBookEntry[] |
| `logAuditEvent` | action: string, entityType: string, entityId?: string, beforeValues?: Record<string, unknown>, afterValues?: Record<string, unknown>, reason?: string, correlationId?: string, options: RequestOptions = {} | string |
| `getAuditEvents` | entityType?: string, entityId?: string, action?: string, limit?: number, options: RequestOptions = {} | AuditEvent[] |
| `submitFeeWaiver` | studentId: string, amount: number, reason: string, invoiceId?: string, supportingReference?: string, options: RequestOptions = {} | string |
| `approveFeeWaiver` | waiverId: string, reviewNotes?: string, options: RequestOptions = {} | boolean |
| `rejectFeeWaiver` | waiverId: string, reviewNotes?: string, options: RequestOptions = {} | boolean |
| `cancelFeeWaiver` | waiverId: string, options: RequestOptions = {} | boolean |
| `getFeeWaivers` | status?: string, studentId?: string, options: RequestOptions = {} | FeeWaiver[] |
| `getFiscalPeriods` | options: RequestOptions = {} | FiscalPeriod[] |
| `createFiscalPeriod` | name: string, startDate: string, endDate: string, options: RequestOptions = {} | string |
| `closeFiscalPeriod` | periodId: string, reason?: string, options: RequestOptions = {} | boolean |
| `reopenFiscalPeriod` | periodId: string, reason: string, options: RequestOptions = {} | boolean |
| `isPeriodLocked` | date: string, options: RequestOptions = {} | boolean |
| `getBudgets` | status?: string, options: RequestOptions = {} | Budget[] |
| `createBudget` | name: string, fiscalPeriodId?: string, description?: string, options: RequestOptions = {} | string |
| `addBudgetLine` | budgetId: string, accountId?: string, voteHeadId?: string, budgetType?: string, amount?: number, notes?: string, options: RequestOptions = {} | string |
| `approveBudget` | budgetId: string, options: RequestOptions = {} | boolean |
| `getBudgetVsActual` | budgetId: string, startDate?: string, endDate?: string, options: RequestOptions = {} | BudgetVsActual[] |
| `getDailyAttendance` | date: string, classId?: string, streamId?: string, options: RequestOptions = {} | DailyAttendanceRow[] |
| `saveDailyAttendance` | date: string, entries: Array<{ student_id: string; status: string; absence_reason?: string; arrival_time?: string; remarks?: string }>, options: RequestOptions = {} | number |
| `getAttendanceSummary` | startDate: string, endDate: string, classId?: string, options: RequestOptions = {} | AttendanceSummaryRow[] |
| `getEmergencyContacts` | studentId: string, options: RequestOptions = {} | EmergencyContact[] |
| `upsertEmergencyContact` | studentId: string, fullName: string, relationship: string, phonePrimary: string, phoneSecondary?: string, email?: string, isPrimary?: boolean, isAuthorizedPickup?: boolean, notes?: string, contactId?: string, options: RequestOptions = {} | string |
| `getMedicalAlerts` | studentId: string, options: RequestOptions = {} | MedicalAlert[] |
| `upsertMedicalAlert` | studentId: string, alertType: string, description: string, severity?: string, instructions?: string, isActive?: boolean, alertId?: string, options: RequestOptions = {} | string |
| `getLeaveTypes` | options: RequestOptions = {} | LeaveType[] |
| `createLeaveType` | name: string, description?: string, maxDaysPerYear?: number, isPaid?: boolean, options: RequestOptions = {} | string |
| `submitLeaveRequest` | leaveTypeId: string, startDate: string, endDate: string, reason?: string, options: RequestOptions = {} | string |
| `approveLeaveRequest` | requestId: string, reviewNotes?: string, options: RequestOptions = {} | boolean |
| `rejectLeaveRequest` | requestId: string, rejectionReason?: string, options: RequestOptions = {} | boolean |
| `getLeaveRequests` | status?: string, staffId?: string, options: RequestOptions = {} | LeaveRequest[] |
| `getDutyRosters` | options: RequestOptions = {} | DutyRoster[] |
| `createDutyRoster` | dutyType: string, startDate: string, endDate: string, description?: string, options: RequestOptions = {} | string |
| `getDutyAssignments` | rosterId: string, options: RequestOptions = {} | DutyAssignment[] |
| `assignDuty` | rosterId: string, staffId: string, dutyDate: string, dutyPeriod?: string, notes?: string, options: RequestOptions = {} | string |
| `getSubstitutions` | date?: string, options: RequestOptions = {} | Substitution[] |
| `createSubstitution` | originalStaffId: string, substituteStaffId: string, substitutionDate: string, timetableEntryId?: string, reason?: string, options: RequestOptions = {} | string |
| `getLessonPlans` | subjectId?: string, classId?: string, teacherId?: string, options: RequestOptions = {} | LessonPlan[] |
| `createLessonPlan` | topic: string, subjectId?: string, classId?: string, streamId?: string, teacherId?: string, timetableEntryId?: string, subtopic?: string, learningObjectives?: string, intendedOutcomes?: string, learningActivities?: string, teachingResources?: string, assessmentMethods?: string, teacherNotes?: string, plannedDate?: string, durationMinutes?: number, options: RequestOptions = {} | string |
| `updateLessonPlanStatus` | planId: string, status: string, completionPct?: number, options: RequestOptions = {} | boolean |
| `getCurriculumCoverage` | subjectId?: string, classId?: string, term?: string, academicYear?: number, options: RequestOptions = {} | CurriculumCoverage[] |
| `upsertCurriculumCoverage` | subjectId: string, term: string, academicYear: number, curriculumTopic: string, classId?: string, curriculumSubtopic?: string, isPlanned?: boolean, isTaught?: boolean, taughtDate?: string, lessonPlanId?: string, notes?: string, options: RequestOptions = {} | string |
| `getCurriculumCoverageSummary` | subjectId?: string, classId?: string, term?: string, academicYear?: number, options: RequestOptions = {} | CurriculumCoverageSummary[] |
| `getTeacherWorkload` | options: RequestOptions = {} | TeacherWorkload[] |
| `getPayrollPeriods` | options: RequestOptions = {} | PayrollPeriod[] |
| `createPayrollPeriod` | name: string, startDate: string, endDate: string, options: RequestOptions = {} | string |
| `getPayrollEntries` | periodId: string, options: RequestOptions = {} | PayrollEntry[] |
| `generatePayroll` | periodId: string, options: RequestOptions = {} | number |
| `approvePayroll` | periodId: string, options: RequestOptions = {} | boolean |
| `finalizePayroll` | periodId: string, options: RequestOptions = {} | boolean |
| `getSalaryComponents` | options: RequestOptions = {} | SalaryComponent[] |
| `upsertSalaryComponent` | name: string, componentType: string, calculationType?: string, defaultAmount?: number, percentageRate?: number, isTaxable?: boolean, isPensionable?: boolean, statutoryType?: string, effectiveFrom?: string, effectiveTo?: string, isActive?: boolean, componentId?: string, options: RequestOptions = {} | string |
| `getEmployeeSalaries` | staffId?: string, options: RequestOptions = {} | EmployeeSalary[] |
| `upsertEmployeeSalary` | staffId: string, basicSalary: number, effectiveFrom?: string, effectiveTo?: string, isActive?: boolean, salaryId?: string, options: RequestOptions = {} | string |
| `getDataRetentionPolicies` | options: RequestOptions = {} | DataRetentionPolicy[] |
| `upsertDataRetentionPolicy` | entityType: string, retentionDays: number, action?: string, isActive?: boolean, options: RequestOptions = {} | string |
| `getLibraryBooks` | search?: string, options: RequestOptions = {} | LibraryBook[] |
| `addLibraryBook` | title: string, author?: string, isbn?: string, category?: string, publisher?: string, publicationYear?: number, totalCopies?: number, location?: string, options: RequestOptions = {} | string |
| `borrowBook` | bookId: string, borrowerId: string, borrowerType?: string, dueDate?: string, options: RequestOptions = {} | string |
| `returnBook` | loanId: string, fineAmount?: number, options: RequestOptions = {} | boolean |
| `getBookLoans` | status?: string, borrowerId?: string, options: RequestOptions = {} | BookLoan[] |
| `getVehicles` | options: RequestOptions = {} | Vehicle[] |
| `addVehicle` | registrationNumber: string, vehicleType?: string, capacity?: number, make?: string, model?: string, year?: number, options: RequestOptions = {} | string |
| `getTransportRoutes` | options: RequestOptions = {} | TransportRoute[] |
| `createTransportRoute` | name: string, description?: string, vehicleId?: string, driverId?: string, pickupPoints?: string, departureTime?: string, returnTime?: string, options: RequestOptions = {} | string |
| `getStudentTransport` | studentId?: string, options: RequestOptions = {} | StudentTransport[] |
| `assignStudentTransport` | studentId: string, routeId: string, pickupPoint?: string, options: RequestOptions = {} | string |
| `getMealPlans` | residenceId?: string, date?: string, options: RequestOptions = {} | MealPlan[] |
| `createMealPlan` | residenceId: string, mealDate: string, mealType: string, menu?: string, options: RequestOptions = {} | string |
| `saveMealAttendance` | mealPlanId: string, entries: Array<{ student_id: string; status: string }>, options: RequestOptions = {} | number |
| `getBoardingRollCalls` | residenceId?: string, date?: string, options: RequestOptions = {} | BoardingRollCall[] |
| `createBoardingRollCall` | residenceId: string, rollCallDate: string, rollCallTime?: string, rollCallType?: string, options: RequestOptions = {} | string |
| `saveBoardingRollCallEntries` | rollCallId: string, entries: Array<{ student_id: string; status: string; remarks?: string }>, options: RequestOptions = {} | number |
| `getBoardingRollCallEntries` | rollCallId: string, options: RequestOptions = {} | Array<{ entry_id: string; student_id: string; student_name: string | null; admission_no: string; status: string; remarks: string | null } |
| `getSports` | options: RequestOptions = {} | Sport[] |
| `createSport` | name: string, description?: string, sportType?: string, options: RequestOptions = {} | string |
| `getSportsEvents` | sportId?: string, options: RequestOptions = {} | SportsEvent[] |
| `createSportsEvent` | title: string, eventDate: string, sportId?: string, eventType?: string, venue?: string, opponent?: string, result?: string, score?: string, notes?: string, options: RequestOptions = {} | string |
| `getSportsParticipation` | eventId: string, options: RequestOptions = {} | SportsParticipation[] |
| `addSportsParticipation` | eventId: string, studentId: string, role?: string, performanceNotes?: string, options: RequestOptions = {} | string |
| `getTrips` | status?: string, options: RequestOptions = {} | Trip[] |
| `createTrip` | title: string, destination: string, startDate: string, endDate: string, tripType?: string, description?: string, departureTime?: string, returnTime?: string, transportMode?: string, estimatedCost?: number, options: RequestOptions = {} | string |
| `getTripParticipants` | tripId: string, options: RequestOptions = {} | TripParticipant[] |
| `addTripParticipant` | tripId: string, studentId: string, permissionSlipSigned?: boolean, permissionSlipDate?: string, paymentStatus?: string, amountPaid?: number, notes?: string, options: RequestOptions = {} | string |
| `updateTripStatus` | tripId: string, status: string, actualCost?: number, options: RequestOptions = {} | boolean |
| `getBankStatements` | options: RequestOptions = {} | BankStatement[] |
| `createBankStatement` | accountName: string, statementDate: string, bankName?: string, openingBalance?: number, closingBalance?: number, fileName?: string, options: RequestOptions = {} | string |
| `addBankStatementLine` | statementId: string, transactionDate: string, description?: string, referenceNumber?: string, debit?: number, credit?: number, direction?: string, options: RequestOptions = {} | string |
| `getBankStatementLines` | statementId: string, matchStatus?: string, options: RequestOptions = {} | BankStatementLine[] |
| `matchBankLine` | lineId: string, paymentId?: string, collectionId?: string, notes?: string, options: RequestOptions = {} | boolean |
| `unmatchBankLine` | lineId: string, reason?: string, options: RequestOptions = {} | boolean |
| `completeReconciliation` | statementId: string, options: RequestOptions = {} | boolean |

## Types

### ClassPerformanceStudent

```typescript
interface ClassPerformanceStudent {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
  total_score: number;
  mean_score: number;
  mean_percentage: number;
  overall_grade: string | null;
  overall_points: number | null;
  class_position: number;
  subjects_count: number;
  passed_count: number;
}
```

### GradeDistribution

```typescript
interface GradeDistribution {
  grade_code: string;
  grade_name: string;
  broad_grade: string;
  count: number;
  percentage: number;
  color: string;
}
```

### SubjectPerformance

```typescript
interface SubjectPerformance {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_students: number;
  mean_score: number;
  highest_score: number;
  lowest_score: number;
  pass_count: number;
  pass_rate: number;
  ee_count: number;
  me_count: number;
  ae_count: number;
  be_count: number;
}
```

### StudentReportSubject

```typescript
interface StudentReportSubject {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  score: number;
  percentage: number;
  grade: string;
  grade_name: string;
  points: number | null;
}
```

### StudentReportData

```typescript
interface StudentReportData {
  student: {
  id: string;
  admission_no: string;
  name: string;
  class: string | null;
  stream: string | null;
  /** Latest enrollment academic year; null when the student has no enrollment. */
  academic_year?: number | null;
  gender: string | null;
}
```

### MarkSheetRow

```typescript
interface MarkSheetRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_name: string | null;
  stream_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  score: number;
  grade_code: string | null;
  grade_name: string | null;
  points: number | null;
}
```

### StudentExamHistoryRow

```typescript
interface StudentExamHistoryRow {
  exam_id: string;
  exam_name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  total_score: number;
  mean_score: number;
  subjects_count: number;
  overall_grade: string | null;
  overall_points: number | null;
  position: number;
  total_in_exam: number;
}
```

### MostImprovedRow

```typescript
interface MostImprovedRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  stream_name: string | null;
  current_mean: number;
  previous_mean: number;
  delta: number;
  previous_exam_name: string;
}
```

### AccountDirectoryRow

```typescript
interface AccountDirectoryRow {
  account_id: string;
  /** Null when the profile has no name recorded. */
  full_name: string | null;
  /** Account email from `profiles.email` or `auth.users.email`. */
  email?: string | null;
  /** Free-text role string from `profiles.role`; null when unset. */
  role: string | null;
  /** Zeraki staff classification (`TEACHER`, `OFFICIAL`, `WORKER`). */
  staff_type?: StaffType;
  is_active: boolean;
  /** True when all permissions are revoked via `set_user_access_revoked`. */
  access_revoked?: boolean;
  /** Count of per-user `GRANT` overrides in `user_permissions`. */
  granted_overrides?: number;
  /** Count of per-user `DENY` overrides in `user_permissions`. */
  denied_overrides?: number;
  /** ISO timestamp from `profiles.created_at`. */
  created_at: string;
}
```

### PermissionCatalogueItem

```typescript
interface PermissionCatalogueItem {
  code: string;
  category_code: string;
  category_name: string;
  display_name: string;
  sort_order: number;
}
```

### RoleWithPermissionsRow

```typescript
interface RoleWithPermissionsRow {
  role_id: string | null;
  role_key: string;
  display_name: string;
  description: string;
  staff_type: StaffType;
  scope: RoleScope;
  member_count: number;
  active_count: number;
  inactive_count: number;
  permission_codes: string[];
}
```

### UserPermissionProfile

```typescript
interface UserPermissionProfile {
  account_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  staff_type: StaffType;
  is_active: boolean;
  access_revoked: boolean;
  role_permissions: string[];
  granted_overrides: string[];
  denied_overrides: string[];
  effective_permissions: string[];
}
```

### SectionHeadRow

```typescript
interface SectionHeadRow {
  section_head_id: string;
  form_level: string;
  user_id: string;
  user_full_name: string | null;
  user_email: string | null;
  user_role: string | null;
  staff_type: StaffType;
  created_at: string;
}
```

### SubjectOption

```typescript
interface SubjectOption {
  id: string;
  name: string;
  code: string;
}
```

### ExamSetupOptions

```typescript
interface ExamSetupOptions {
  classes: ClassOption[];
  streams: StreamOption[];
  subjects: SubjectOption[];
}
```

### ExamPipelineRow

```typescript
interface ExamPipelineRow {
  exam_id: string;
  name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  status: ExamLifecycleStatus;
  class_ids: string[];
  class_names: string[];
  enrolled_students: number;
  students_with_marks: number;
  subjects_with_marks: number;
  total_marks_entered: number;
  created_at: string;
}
```

### ExamMarkEntryRow

```typescript
interface ExamMarkEntryRow {
  student_id: string;
  admission_no: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  score: number | null;
  grade_code: string | null;
  points: number | null;
}
```

### SubjectPublishStatusRow

```typescript
interface SubjectPublishStatusRow {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  enrolled_students: number;
  recorded_marks: number;
  missing_marks: number;
  mean_score: number;
  published: boolean;
  published_at: string | null;
  teacher_access_granted: boolean;
}
```

### ExamPublishReadinessRow

```typescript
interface ExamPublishReadinessRow {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  enrolled_students: number;
  recorded_marks: number;
  missing_marks: number;
  mean_score: number;
}
```

### TeacherDirectoryRow

```typescript
interface TeacherDirectoryRow {
  account_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  initials: string | null;
  tsc_number: string | null;
  national_id: string | null;
  employee_number: string | null;
  gender: string | null;
  role: string | null;
  staff_type: StaffType;
  is_active: boolean;
  access_revoked: boolean;
  group_names: string[];
  subject_assignments_count: number;
  class_teacher_labels: string[];
  supervisor_labels: string[];
  created_at: string;
}
```

### StaffGroupRow

```typescript
interface StaffGroupRow {
  group_id: string;
  name: string;
  staff_type: StaffType;
  member_count: number;
  created_at: string;
}
```

### TeacherAllocationRow

```typescript
interface TeacherAllocationRow {
  allocation_id: string;
  allocation_type: TeacherAllocationType;
  academic_year: number;
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_code: string | null;
  teacher_id: string;
  teacher_name: string | null;
  teacher_initials: string | null;
  teacher_tsc_number: string | null;
}
```

### TeacherSubjectClassPerformanceRow

```typescript
interface TeacherSubjectClassPerformanceRow {
  allocation_id: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_initials: string | null;
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  students_count: number;
  mean_score: number;
  mean_grade: string | null;
  mean_points: number | null;
  pass_rate: number;
}
```

### StudentDirectoryRow

```typescript
interface StudentDirectoryRow {
  student_id: string;
  admission_no: string;
  full_name: string | null;
  gender: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  academic_year: number | null;
  pathway_name: string | null;
  in_school_status: string | null;
  created_at: string;
}
```

### StudentProfileData

```typescript
interface StudentProfileData {
  student_id: string;
  admission_no: string;
  full_name: string | null;
  gender: string | null;
  class_id: string | null;
  stream_id: string | null;
  pathway: string | null;
  created_at: string;
  enrollments: Array<{
  academic_year: number | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  created_at: string | null;
}
```

### SchoolProfile

```typescript
interface SchoolProfile {
  tenant_id: string;
  name: string;
  school_type: string | null;
  country: string | null;
  region: string | null;
  county: string | null;
  education_system: string | null;
  ownership_type: string | null;
  setup_stage: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_valid: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  watermark_url: string | null;
  logo_url: string | null;
  motto: string | null;
  created_at: string;
}
```

### SchoolValidity

```typescript
interface SchoolValidity {
  tenant_id: string;
  name: string;
  is_valid: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
  days_remaining: number | null;
  is_expired: boolean;
}
```

### TermDateRow

```typescript
interface TermDateRow {
  term_date_id: string;
  academic_year: number;
  term: string;
  opening_date: string;
  closing_date: string;
}
```

### ReportTemplateConfig

```typescript
interface ReportTemplateConfig {
  config_key: string;
  config_value: string;
}
```

### MessageLogRow

```typescript
interface MessageLogRow {
  message_id: string;
  recipient_type: string;
  message_type: string;
  subject: string | null;
  message_body: string;
  recipient_count: number;
  credits_used: number;
  status: string;
  exam_id: string | null;
  exam_name: string | null;
  sent_at: string | null;
  created_at: string;
  sender_name: string | null;
}
```

### MessageRecipients

```typescript
interface MessageRecipients {
  students: Array<{
  id: string;
  name: string | null;
  admission_no: string;
  class_name: string | null;
  stream_name: string | null;
  gender: string | null;
}
```

### SmsGatewayConfig

```typescript
interface SmsGatewayConfig {
  tenant_id: string;
  gateway_type: string;
  description: string;
  companion_app: string;
  mechanism: string;
  required_permissions: string[];
  supports_dual_sim: boolean;
  supports_delivery_tracking: boolean;
  max_batch_size: number;
}
```

### PendingSmsRow

```typescript
interface PendingSmsRow {
  message_id: string;
  phone_numbers: string[];
  message_body: string;
  recipient_count: number;
  created_at: string;
}
```

### AttendanceRow

```typescript
interface AttendanceRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  status: string;
  remarks: string | null;
}
```

### BehaviourRow

```typescript
interface BehaviourRow {
  id: string;
  student_id: string;
  behaviour_type: string;
  description: string | null;
  severity: string | null;
  recorded_by: string | null;
  recorded_at: string;
  action_taken: string | null;
}
```

### StudentNote

```typescript
interface StudentNote {
  id: string;
  student_id: string;
  note_type: string;
  title: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
}
```

### StudentGroup

```typescript
interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}
```

### StudentResidence

```typescript
interface StudentResidence {
  id: string;
  name: string;
  residence_type: string;
  capacity: number | null;
  supervisor_name: string | null;
  occupant_count: number;
}
```

### SubjectPaper

```typescript
interface SubjectPaper {
  id: string;
  subject_id: string;
  name: string;
  code: string | null;
  max_marks: number;
  weight: number;
  sort_order: number;
}
```

### Pathway

```typescript
interface Pathway {
  id: string;
  name: string;
  track: string | null;
  description: string | null;
}
```

### FeeStructure

```typescript
interface FeeStructure {
  structure_id: string;
  class_id: string | null;
  class_name: string | null;
  academic_year: number;
  term: string;
  name: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}
```

### FeePayment

```typescript
interface FeePayment {
  payment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  academic_year: number | null;
  term: string | null;
  notes: string | null;
  recorded_by_name: string | null;
  paid_at: string;
}
```

### FeeBalance

```typescript
interface FeeBalance {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  total_fees: number;
  total_paid: number;
  balance: number;
}
```

### FeePledge

```typescript
interface FeePledge {
  pledge_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  pledged_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}
```

### TimetableEntry

```typescript
interface TimetableEntry {
  entry_id: string | null;
  slot_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  slot_label: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  room: string | null;
  notes: string | null;
}
```

### EventRow

```typescript
interface EventRow {
  event_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  is_all_day: boolean;
  created_by_name: string | null;
  created_at: string;
}
```

### NoticeRow

```typescript
interface NoticeRow {
  notice_id: string;
  title: string;
  content: string;
  notice_type: string;
  target_audience: string;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_by_name: string | null;
  created_at: string;
}
```

### ClassWithStreams

```typescript
interface ClassWithStreams {
  class_id: string;
  class_name: string;
  stream_id: string | null;
  stream_name: string | null;
  student_count: number;
}
```

### SubjectWithDetails

```typescript
interface SubjectWithDetails {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  department: string;
  is_compulsory: boolean;
  paper_count: number;
}
```

### StaffDirectoryRow

```typescript
interface StaffDirectoryRow {
  staff_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  staff_type: string | null;
  is_active: boolean;
  class_count: number;
  created_at: string;
}
```

### CounsellingSession

```typescript
interface CounsellingSession {
  session_id: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  counsellor_name: string | null;
  session_date: string;
  session_type: string;
  topic: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  status: string;
}
```

### CounsellingReferral

```typescript
interface CounsellingReferral {
  referral_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  referred_by_name: string | null;
  reason: string;
  urgency: string;
  status: string;
  notes: string | null;
  created_at: string;
}
```

### MedicalVisit

```typescript
interface MedicalVisit {
  visit_id: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  treatment: string | null;
  referred_to: string | null;
  attended_by_name: string | null;
  status: string;
  notes: string | null;
}
```

### MedicalInventoryItem

```typescript
interface MedicalInventoryItem {
  item_id: string;
  item_name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  supplier: string | null;
}
```

### ParentStudentLink

```typescript
interface ParentStudentLink {
  link_id: string;
  parent_id: string;
  parent_name: string | null;
  parent_email: string | null;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
}
```

### ParentRow

```typescript
interface ParentRow {
  parent_id: string;
  full_name: string | null;
  email: string | null;
  linked_students: number;
}
```

### Opportunity

```typescript
interface Opportunity {
  opportunity_id: string;
  title: string;
  description: string | null;
  opportunity_type: string;
  eligibility_criteria: string | null;
  deadline: string | null;
  application_url: string | null;
  is_active: boolean;
  applicant_count: number;
  created_at: string;
}
```

### OpportunityApplication

```typescript
interface OpportunityApplication {
  application_id: string;
  opportunity_id: string;
  opportunity_title: string | null;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  status: string;
  notes: string | null;
  applied_at: string;
}
```

### ExamComment

```typescript
interface ExamComment {
  comment_id: string;
  exam_id: string | null;
  exam_name: string | null;
  student_id: string | null;
  student_name: string | null;
  category_name: string | null;
  comment_text: string;
  comment_type: string;
  target_type: string;
  created_by_name: string | null;
  created_at: string;
}
```

### CommentCategory

```typescript
interface CommentCategory {
  category_id: string;
  name: string;
  category_type: string;
  description: string | null;
}
```

### Invoice

```typescript
interface Invoice {
  invoice_id: string;
  invoice_number: string;
  student_id: string | null;
  student_name: string | null;
  admission_no: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  issued_date: string;
  notes: string | null;
  created_at: string;
}
```

### Receipt

```typescript
interface Receipt {
  receipt_id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  receipt_number: string;
  amount_paid: number;
  payment_method: string;
  reference_number: string | null;
  paid_at: string;
  recorded_by_name: string | null;
}
```

### Wallet

```typescript
interface Wallet {
  wallet_id: string;
  owner_id: string;
  balance: number;
  currency: string;
  owner_type: string;
}
```

### WalletTransaction

```typescript
interface WalletTransaction {
  transaction_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  reference_number: string | null;
  payment_method: string | null;
  created_at: string;
}
```

### VoteHead

```typescript
interface VoteHead {
  vote_head_id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  is_active: boolean;
}
```

### VoteHeadCategory

```typescript
interface VoteHeadCategory {
  category_id: string;
  name: string;
  description: string | null;
}
```

### FeeStructureGroup

```typescript
interface FeeStructureGroup {
  group_id: string;
  name: string;
  description: string | null;
}
```

### FeeCollection

```typescript
interface FeeCollection {
  collection_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  vote_head_name: string | null;
  amount: number;
  collection_type: string;
  payment_method: string | null;
  reference_number: string | null;
  academic_year: number | null;
  term: string | null;
  recorded_by_name: string | null;
  collected_at: string;
}
```

### ReversalReason

```typescript
interface ReversalReason {
  reason_id: string;
  reason: string;
  is_active: boolean;
}
```

### StudentVoteHeadBalance

```typescript
interface StudentVoteHeadBalance {
  vote_head_id: string;
  vote_head_name: string;
  vote_head_code: string | null;
  category_name: string | null;
  balance: number;
}
```

### ChartOfAccount

```typescript
interface ChartOfAccount {
  account_id: string;
  code: string;
  name: string;
  account_type: string;
  parent_id: string | null;
  parent_name: string | null;
  is_active: boolean;
  description: string | null;
}
```

### TrialBalanceRow

```typescript
interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}
```

### CashBookEntry

```typescript
interface CashBookEntry {
  entry_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  description: string;
  account_code: string | null;
  account_name: string | null;
  reference_number: string | null;
  payment_method: string | null;
  recorded_by_name: string | null;
  created_at: string;
}
```

### AuditEvent

```typescript
interface AuditEvent {
  event_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: string;
}
```

### FeeWaiver

```typescript
interface FeeWaiver {
  waiver_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  invoice_id: string | null;
  amount: number;
  reason: string;
  supporting_reference: string | null;
  status: string;
  requested_by_name: string | null;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_at: string | null;
}
```

### FiscalPeriod

```typescript
interface FiscalPeriod {
  period_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  closed_by_name: string | null;
  closed_at: string | null;
  close_reason: string | null;
  reopened_by_name: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}
```

### Budget

```typescript
interface Budget {
  budget_id: string;
  name: string;
  fiscal_period_id: string | null;
  fiscal_period_name: string | null;
  status: string;
  version: number;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  line_count: number;
  total_budget: number;
}
```

### BudgetVsActual

```typescript
interface BudgetVsActual {
  line_id: string;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  vote_head_id: string | null;
  vote_head_name: string | null;
  budget_type: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number | null;
}
```

### DailyAttendanceRow

```typescript
interface DailyAttendanceRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  class_name: string | null;
  stream_name: string | null;
  status: string;
  absence_reason: string | null;
  arrival_time: string | null;
  remarks: string | null;
  recorded_at: string | null;
}
```

### AttendanceSummaryRow

```typescript
interface AttendanceSummaryRow {
  student_id: string;
  student_name: string | null;
  admission_no: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  excused_days: number;
  sick_days: number;
  attendance_pct: number;
}
```

### EmergencyContact

```typescript
interface EmergencyContact {
  contact_id: string;
  student_id: string;
  full_name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  is_primary: boolean;
  is_authorized_pickup: boolean;
  notes: string | null;
}
```

### MedicalAlert

```typescript
interface MedicalAlert {
  alert_id: string;
  student_id: string;
  alert_type: string;
  description: string;
  severity: string;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
}
```

### LeaveType

```typescript
interface LeaveType {
  leave_type_id: string;
  name: string;
  description: string | null;
  max_days_per_year: number | null;
  is_paid: boolean;
  is_active: boolean;
}
```

### LeaveRequest

```typescript
interface LeaveRequest {
  request_id: string;
  staff_id: string;
  staff_name: string | null;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}
```

### DutyRoster

```typescript
interface DutyRoster {
  roster_id: string;
  duty_type: string;
  description: string | null;
  start_date: string;
  end_date: string;
  assignment_count: number;
}
```

### DutyAssignment

```typescript
interface DutyAssignment {
  assignment_id: string;
  staff_id: string;
  staff_name: string | null;
  duty_date: string;
  duty_period: string | null;
  notes: string | null;
}
```

### Substitution

```typescript
interface Substitution {
  substitution_id: string;
  original_staff_id: string;
  original_staff_name: string | null;
  substitute_staff_id: string;
  substitute_staff_name: string | null;
  timetable_entry_id: string | null;
  substitution_date: string;
  reason: string | null;
  status: string;
}
```

### LessonPlan

```typescript
interface LessonPlan {
  plan_id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  stream_id: string | null;
  stream_name: string | null;
  topic: string;
  subtopic: string | null;
  learning_objectives: string | null;
  intended_outcomes: string | null;
  learning_activities: string | null;
  teaching_resources: string | null;
  assessment_methods: string | null;
  teacher_notes: string | null;
  planned_date: string | null;
  duration_minutes: number | null;
  status: string;
  completion_pct: number;
  created_at: string;
}
```

### CurriculumCoverage

```typescript
interface CurriculumCoverage {
  coverage_id: string;
  subject_id: string;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  term: string;
  academic_year: number;
  curriculum_topic: string;
  curriculum_subtopic: string | null;
  is_planned: boolean;
  is_taught: boolean;
  taught_date: string | null;
  taught_by_name: string | null;
  notes: string | null;
}
```

### CurriculumCoverageSummary

```typescript
interface CurriculumCoverageSummary {
  subject_id: string;
  subject_name: string | null;
  class_id: string | null;
  class_name: string | null;
  total_topics: number;
  planned_topics: number;
  taught_topics: number;
  coverage_pct: number;
}
```

### TeacherWorkload

```typescript
interface TeacherWorkload {
  teacher_id: string;
  teacher_name: string | null;
  total_periods: number;
  total_hours: number;
  subject_count: number;
  class_count: number;
  duty_count: number;
  substitution_count: number;
}
```

### PayrollPeriod

```typescript
interface PayrollPeriod {
  period_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  finalized_at: string | null;
  entry_count: number;
}
```

### PayrollEntry

```typescript
interface PayrollEntry {
  entry_id: string;
  staff_id: string;
  staff_name: string | null;
  basic_salary: number;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  employer_contributions: number;
  paye: number;
  nssf_employee: number;
  nssf_employer: number;
  sha_employee: number;
  ahl_employee: number;
  ahl_employer: number;
  status: string;
}
```

### SalaryComponent

```typescript
interface SalaryComponent {
  component_id: string;
  name: string;
  component_type: string;
  calculation_type: string;
  default_amount: number | null;
  percentage_rate: number | null;
  is_taxable: boolean;
  is_pensionable: boolean;
  statutory_type: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}
```

### SalaryComponent

```typescript
interface SalaryComponent {
  component_id: string;
  name: string;
  component_type: string;
  calculation_type: string;
  default_amount: number | null;
  percentage_rate: number | null;
  is_taxable: boolean;
  is_pensionable: boolean;
  statutory_type: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}
```

### EmployeeSalary

```typescript
interface EmployeeSalary {
  salary_id: string;
  staff_id: string;
  staff_name: string | null;
  basic_salary: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  component_count: number;
}
```

### DataRetentionPolicy

```typescript
interface DataRetentionPolicy {
  policy_id: string;
  entity_type: string;
  retention_days: number;
  action: string;
  is_active: boolean;
  created_at: string;
}
```

### LibraryBook

```typescript
interface LibraryBook {
  book_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  publication_year: number | null;
  total_copies: number;
  available_copies: number;
  location: string | null;
  is_active: boolean;
}
```

### BookLoan

```typescript
interface BookLoan {
  loan_id: string;
  book_id: string;
  book_title: string | null;
  borrower_id: string;
  borrower_name: string | null;
  borrower_type: string;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number;
  fine_paid: boolean;
  is_overdue: boolean;
}
```

### Vehicle

```typescript
interface Vehicle {
  vehicle_id: string;
  registration_number: string;
  vehicle_type: string;
  capacity: number;
  make: string | null;
  model: string | null;
  year: number | null;
  is_active: boolean;
}
```

### TransportRoute

```typescript
interface TransportRoute {
  route_id: string;
  name: string;
  description: string | null;
  vehicle_id: string | null;
  registration_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  pickup_points: string | null;
  departure_time: string | null;
  return_time: string | null;
  is_active: boolean;
  student_count: number;
}
```

### StudentTransport

```typescript
interface StudentTransport {
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  route_id: string;
  route_name: string | null;
  pickup_point: string | null;
  is_active: boolean;
}
```

### StudentTransport

```typescript
interface StudentTransport {
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  route_id: string;
  route_name: string | null;
  pickup_point: string | null;
  is_active: boolean;
}
```

### MealPlan

```typescript
interface MealPlan {
  plan_id: string;
  residence_id: string | null;
  residence_name: string | null;
  meal_date: string;
  meal_type: string;
  menu: string | null;
  present_count: number;
  absent_count: number;
}
```

### BoardingRollCall

```typescript
interface BoardingRollCall {
  roll_call_id: string;
  residence_id: string;
  residence_name: string | null;
  roll_call_date: string;
  roll_call_time: string;
  roll_call_type: string;
  present_count: number;
  absent_count: number;
  total_count: number;
}
```

### Sport

```typescript
interface Sport {
  sport_id: string;
  name: string;
  description: string | null;
  sport_type: string;
  is_active: boolean;
  event_count: number;
}
```

### SportsEvent

```typescript
interface SportsEvent {
  event_id: string;
  sport_id: string | null;
  sport_name: string | null;
  title: string;
  event_date: string;
  event_type: string;
  venue: string | null;
  opponent: string | null;
  result: string | null;
  score: string | null;
  participant_count: number;
}
```

### SportsParticipation

```typescript
interface SportsParticipation {
  participation_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  role: string;
  performance_notes: string | null;
}
```

### Trip

```typescript
interface Trip {
  trip_id: string;
  title: string;
  description: string | null;
  trip_type: string;
  destination: string;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  return_time: string | null;
  transport_mode: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string;
  participant_count: number;
  permission_slip_count: number;
  created_at: string;
}
```

### TripParticipant

```typescript
interface TripParticipant {
  participant_id: string;
  student_id: string;
  student_name: string | null;
  admission_no: string;
  permission_slip_signed: boolean;
  permission_slip_date: string | null;
  payment_status: string;
  amount_paid: number;
  notes: string | null;
}
```

### BankStatement

```typescript
interface BankStatement {
  statement_id: string;
  account_name: string;
  bank_name: string | null;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  file_name: string | null;
  status: string;
  imported_by_name: string | null;
  imported_at: string;
  line_count: number;
  matched_count: number;
  unmatched_count: number;
}
```

### BankStatementLine

```typescript
interface BankStatementLine {
  line_id: string;
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  debit: number;
  credit: number;
  amount: number;
  direction: string;
  match_status: string;
  matched_payment_id: string | null;
  matched_collection_id: string | null;
  is_duplicate: boolean;
  match_notes: string | null;
}
```

### ExamOption

```typescript
interface ExamOption {
  id: string;
  name: string;
  term: string | null;
  academic_year: number | null;
  assessment_component: string | null;
  status: string;
  published_at: string | null;
}
```

### ClassOption

```typescript
interface ClassOption {
  id: string;
  name: string;
}
```

### StreamOption

```typescript
interface StreamOption {
  id: string;
  class_id: string;
  name: string;
}
```

### AnalyticsSelection

```typescript
interface AnalyticsSelection {
  academicYear: string;
  examId: string;
  classId: string;
  streamId: string;
}
```

