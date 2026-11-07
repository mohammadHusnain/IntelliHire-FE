from apps.common.choices import MemberRole
from apps.common.permissions import CompanyRole

# Who may change an application's status: admin, HR manager and recruiter. Viewers only read.
CanChangeStatus = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
