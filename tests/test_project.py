import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def test_question_bank_contains_expected_concepts_and_fields():
    bank = json.loads((PUBLIC / "data" / "question_bank.json").read_text(encoding="utf-8"))
    assert len(bank) == 18
    assert {q["concept"] for q in bank} == {
        "Overfitting", "Classification", "Regression", "Cross Validation", "Underfitting", "KNN"
    }
    assert all({"id", "concept", "difficulty", "question", "answer"}.issubset(q) for q in bank)


def test_website_assets_exist_and_are_referenced():
    html = (PUBLIC / "index.html").read_text(encoding="utf-8")
    assert 'href="/style.css"' in html
    assert 'src="/app.js"' in html
    assert (PUBLIC / "style.css").is_file()
    assert (PUBLIC / "app.js").is_file()
    assert (PUBLIC / "favicon.svg").is_file()


def test_vercel_is_static_only():
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    assert config["outputDirectory"] == "public"
    assert "functions" not in config
    assert "builds" not in config
