from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        user = self.model(email=email.strip().lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.update(
            role=self.model.Role.PLATFORM_ADMIN,
            status=self.model.Status.ACTIVE,
            email_verified=True,
            is_staff=True,
            is_superuser=True,
        )
        return self.create_user(email, password, **extra_fields)
