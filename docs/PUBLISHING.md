# Publishing

Releases are driven by tags. Pushing `v3.0.0` runs `.github/workflows/release.yml`,
which lints, type-checks, runs the tests under `xvfb`, packages the `.vsix`,
publishes it to both registries and attaches it to the GitHub release.

Two registries matter. The **Visual Studio Marketplace** serves VS Code itself.
**Open VSX** serves everything that legally cannot use the Marketplace: VS Codium,
Cursor, Windsurf, Gitpod, Eclipse Theia. Publishing to only one leaves a real part
of the audience unable to install the extension.

## Open VSX

No Microsoft account is involved — it authenticates through GitHub.

1. Sign in at [open-vsx.org](https://open-vsx.org) with GitHub.
2. Sign the Eclipse Publisher Agreement (required once, from the user settings page).
3. Create an access token and the namespace:
   ```bash
   npx ovsx create-namespace banochkin -p <token>
   ```
4. Store the token as the `OVSX_PAT` repository secret. The release job skips the
   Open VSX step when the secret is absent, so it is safe to add later.

## Visual Studio Marketplace

### Personal access token — what the pipeline currently uses

The publisher lives at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage),
but tokens come from Azure DevOps, and that section only appears once the account
owns at least one **organisation**. Creating one at [dev.azure.com](https://dev.azure.com)
is free and needs no Azure subscription and no payment method.

1. Create an organisation at [dev.azure.com](https://dev.azure.com).
2. User settings → **Personal access tokens** → **New Token**.
3. Scopes → **Custom defined** → **Show all scopes** → **Marketplace** → **Manage**.
4. For Organization, pick that single organisation rather than *All accessible
   organizations*: global tokens are retired on **2026-12-01**, organisation-scoped
   tokens are not.
5. Store it as the `VSCE_PAT` repository secret.

Publishing by hand, should it ever be needed:

```bash
npx vsce publish --packagePath filescope.vsix -p <token>
```

### Workload identity federation — the token-free alternative

Microsoft's recommended path uses Entra ID instead of a stored secret, with
`vsce publish --azure-credential`. It is genuinely better — nothing long-lived is
stored anywhere — but it requires an Azure subscription, which a personal
Microsoft account does not have by default. Recorded here so the migration does
not have to be researched from scratch.

Three things cost far more to discover than they should:

**The identity must be a user-assigned managed identity.** An app registration is
free and needs no subscription, so it looks like the obvious choice; it
authenticates successfully and then fails at the publish step with
`InvalidAccessException: The requested operation is not allowed`
([vscode-vsce#976](https://github.com/microsoft/vscode-vsce/issues/976),
[#1023](https://github.com/microsoft/vscode-vsce/issues/1023)).

**Scope the federated credential to a GitHub environment**, not a branch or a tag.
A tag-scoped credential matches one exact tag name and stops working on the second
release.

**The Marketplace cannot find the identity by client id, object id or ARM resource
id.** It only accepts the identity's Azure DevOps *profile* id, and that profile
does not exist until the identity has called Azure DevOps at least once:

```bash
az rest --url https://app.vssps.visualstudio.com/_apis/profile/profiles/me \
        --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id --output tsv
```

Paste the result into the publisher's Members list with the Contributor role.

The workflow changes to:

```yaml
permissions:
  contents: write
  id-token: write

jobs:
  publish:
    environment: marketplace-publish   # must match the federated credential
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - run: npx @vscode/vsce publish --packagePath filescope.vsix --azure-credential --skip-duplicate
```

## Cutting a release

```bash
npm version minor        # bumps package.json and creates the tag
git push --follow-tags
```

Version numbers follow the Marketplace convention: even minor versions are stable
releases, odd ones are pre-releases published with `--pre-release`.
