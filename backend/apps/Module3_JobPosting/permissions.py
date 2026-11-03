from apps.common.choices import MemberRole
from apps.common.permissions import CompanyRole

# Who may change jobs: admin, HR manager and recruiter; viewers only read (Doc §3.4).
CanEditJobs = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
# Deleting a draft and reopening a closed job are limited to admin and HR manager.
CanManageJobs = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER)
