import json
import unittest.mock
from app.main import fire_slack_webhook


def test_slack_webhook_payload_structure():
    with unittest.mock.patch("urllib.request.urlopen") as mock_urlopen:
        mock_response = unittest.mock.MagicMock()
        mock_response.status = 200
        mock_urlopen.return_value.__enter__.return_value = mock_response

        fire_slack_webhook(
            webhook_url="https://hooks.slack.com/services/T00/B00/X00",
            org_id="org_test",
            condition_type="error_rate_spike",
            threshold=0.05,
            observed=0.12,
            window_mins=15,
        )

        assert mock_urlopen.called
        req = mock_urlopen.call_args[0][0]
        data = json.loads(req.data.decode("utf-8"))
        assert "error_rate_spike" in data["text"]
        assert "org_test" in data["text"]
        assert len(data["blocks"]) >= 2
