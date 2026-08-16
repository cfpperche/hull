from hull_fastapi.config import Settings


def test_mail_from_and_welcome_follow_brand() -> None:
    s = Settings(host="acme.dev", brand="Acme", mail_from="", public_origin="")
    assert s.resolved_mail_from() == "Acme <noreply@acme.dev>"
    assert s.welcome_subject() == "Welcome to Acme"
    assert s.resolved_public_origin() == "https://app.acme.dev"
    assert s.resolved_mark() == "A"


def test_explicit_mail_from_wins() -> None:
    s = Settings(brand="Acme", mail_from="Ops <ops@acme.dev>", mark="X")
    assert s.resolved_mail_from() == "Ops <ops@acme.dev>"
    assert s.resolved_mark() == "X"
