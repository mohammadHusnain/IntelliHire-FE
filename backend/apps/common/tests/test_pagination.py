from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.common.pagination import StandardPagination

factory = APIRequestFactory()


def paginate(query):
    request = Request(factory.get(f"/?{query}"))
    return StandardPagination().paginate_queryset(list(range(250)), request)


def test_default_page_size_is_20():
    assert len(paginate("")) == 20


def test_page_size_can_be_requested_but_is_capped():
    assert len(paginate("page_size=50")) == 50
    assert len(paginate("page_size=500")) == 100
