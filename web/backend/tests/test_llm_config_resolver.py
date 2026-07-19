from types import SimpleNamespace

import pytest

from web.backend.services.llm_config_resolver import (
    LLMConfigResolutionError,
    select_system_models,
)


def _model(model_type: str, model_name: str):
    return SimpleNamespace(model_type=model_type, model_name=model_name)


def test_selected_system_models_are_preserved_instead_of_falling_back_to_catalog_first():
    models = [
        _model("shallow_thinker", "fast-default"),
        _model("deep_thinker", "reasoning-default"),
        _model("shallow_thinker", "fast-selected"),
        _model("deep_thinker", "reasoning-selected"),
    ]

    assert select_system_models(models, "fast-selected", "reasoning-selected") == (
        "fast-selected",
        "reasoning-selected",
    )


def test_rejects_a_requested_model_that_is_not_active_in_the_system_catalog():
    models = [
        _model("shallow_thinker", "fast-default"),
        _model("deep_thinker", "reasoning-default"),
    ]

    with pytest.raises(LLMConfigResolutionError) as exc_info:
        select_system_models(models, "unknown-model", "reasoning-default")

    assert exc_info.value.code == "REQUEST_MODEL_INVALID"
