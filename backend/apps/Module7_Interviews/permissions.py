from apps.common.choices import MemberRole
from apps.common.permissions import CompanyRole

# Invite, resend, extend, cancel: admin, HR manager, recruiter. Viewers only read.
CanManageInterviews = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
# Score an interview again: admin and HR manager.
CanReevaluate = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER)
