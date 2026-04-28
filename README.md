# action-template

Template repository for creating public GitHub Actions with release workflows, examples, and quality checks
preconfigured.

Use this template as the starting point for a new action repo, then replace the placeholder action metadata,
inputs, outputs, and example workflow with your real implementation.

## Usage

Update the version in this example to the current release tag when publishing.

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2

      - name: Run action
        uses: gh-workflow/action-template@0.0.4
        with:
          example_input: example-value
```

## Template Checklist

- Update `action.yml` with the real action name, description, inputs, outputs, and runtime.
- Replace the usage example in this README with a real example from your action.
- Add or update test workflows for your action implementation.
- Keep release references in this README pinned to the current release tag.
