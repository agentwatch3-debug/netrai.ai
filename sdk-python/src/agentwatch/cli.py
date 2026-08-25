"""AgentWatch Command Line Interface (CLI)."""

import argparse
import os
import sys

from .testing import GoldenTestRunner, load_runner_function


def run_test_command(args: argparse.Namespace) -> int:
    dataset = args.dataset
    runner_spec = args.runner
    endpoint = args.endpoint or os.getenv("AGENTWATCH_ENDPOINT", "http://localhost:8000")
    api_key = args.api_key or os.getenv("AGENTWATCH_API_KEY", "dev-key")
    git_commit = os.getenv("GITHUB_SHA") or os.getenv("GIT_COMMIT")
    git_branch = os.getenv("GITHUB_REF_NAME") or os.getenv("GIT_BRANCH")

    print("\n================================================================================")
    print(f" 🚀 AgentWatch Pre-Deploy Test Runner")
    print(f" Dataset: {dataset} | Runner: {runner_spec}")
    print("================================================================================\n")

    try:
        runner_fn = load_runner_function(runner_spec)
    except Exception as e:
        print(f"❌ Error loading agent runner: {e}")
        return 1

    runner = GoldenTestRunner(endpoint=endpoint, api_key=api_key)
    results = runner.run_tests(dataset, runner_fn, git_commit=git_commit, git_branch=git_branch)

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed
    regressions = sum(1 for r in results if r.is_regression)

    for i, res in enumerate(results, 1):
        if res.passed:
            status_tag = "\033[92m[PASS]\033[0m"
        elif res.is_regression:
            status_tag = "\033[91m\033[1m[REGRESSION]\033[0m"
        else:
            status_tag = "\033[91m[FAIL]\033[0m"

        print(f"{i}. {res.case_id} ({res.eval_type}) -> {status_tag} (Score: {res.score})")
        if not res.passed:
            if res.reason:
                print(f"   Reason: {res.reason}")
            if res.diff_text:
                print("   Diff:")
                for line in res.diff_text.splitlines():
                    if line.startswith("+"):
                        print(f"   \033[92m{line}\033[0m")
                    elif line.startswith("-"):
                        print(f"   \033[91m{line}\033[0m")
                    else:
                        print(f"   {line}")
        print()

    print("--------------------------------------------------------------------------------")
    print(f" Summary: {passed}/{total} Passed | {failed} Failed | {regressions} Regressions")
    print("--------------------------------------------------------------------------------\n")

    if regressions > 0 or failed > 0:
        print("\033[91m❌ Pre-deploy test check failed. Blocking merge.\033[0m\n")
        return 1

    print("\033[92m✅ All golden test cases passed! Safe to deploy.\033[0m\n")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentwatch", description="AgentWatch CLI tool")
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # test sub-parser
    test_parser = subparsers.add_parser("test", help="Test suite commands")
    test_subparsers = test_parser.add_subparsers(dest="test_action", help="Test actions")

    # test run
    run_parser = test_subparsers.add_parser("run", help="Run a golden dataset test suite")
    run_parser.add_argument("--dataset", required=True, help="Golden dataset name (e.g. customer-support-v1)")
    run_parser.add_argument("--runner", required=True, help="Path to runner function (e.g. agent.py:run_agent)")
    run_parser.add_argument("--endpoint", default=None, help="AgentWatch API endpoint URL")
    run_parser.add_argument("--api-key", default=None, help="AgentWatch API key")

    # mcp sub-parser
    mcp_parser = subparsers.add_parser("mcp", help="Start the Model Context Protocol (MCP) stdio server for AIs")
    mcp_parser.add_argument("--endpoint", default=None, help="AgentWatch API endpoint URL")
    mcp_parser.add_argument("--api-key", default=None, help="AgentWatch API key")

    args = parser.parse_args()

    if args.command == "mcp":
        from .mcp_server import AgentWatchMCPServer
        server = AgentWatchMCPServer(endpoint=args.endpoint, api_key=args.api_key)
        server.run_stdio()
    elif args.command == "test" and args.test_action == "run":
        exit_code = run_test_command(args)
        sys.exit(exit_code)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
