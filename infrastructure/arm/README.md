# Azure Resource Group Export

`rg-netways-avatar-dev.template.json` is a sanitized export of the deployed `rg-netways-avatar-dev` resource group. The companion parameters file contains resource names only and no credentials.

## Important limitations

- Azure Resource Group Export reported unsupported child resource types for Cognitive Services computes/safety providers, App Service extensions/certificates/site containers/hybrid connections, and PostgreSQL administrators. Those resources are not represented in the export.
- Key Vault secret values are never exported. Empty secret shells were removed from this committed template. Populate secrets separately through Key Vault or environment configuration.
- Microsoft-managed Responsible AI policy resources were removed because Azure rejects attempts to redeploy or update system policies.
- The local-development PostgreSQL firewall rule was removed from the committed template.
- App Service runtime settings and credentials should be configured from `.env.example` and Key Vault references.
- For a brand-new PostgreSQL server deployment, supply a secure administrator password through a secure deployment process; Azure's export does not include it.

## Validate

```powershell
az deployment group validate `
  --resource-group rg-netways-avatar-dev `
  --template-file infrastructure/arm/rg-netways-avatar-dev.template.json `
  --parameters infrastructure/arm/rg-netways-avatar-dev.parameters.json
```

Treat this export as a reproducible infrastructure baseline, not as a replacement for secret provisioning and post-deployment application configuration.
