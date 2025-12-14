/**
 * Secrets Management Module
 * 
 * Centralized secret retrieval with Azure Key Vault support.
 * Falls back to environment variables if Key Vault is not configured.
 */

let secretCache: Map<string, string> = new Map();
let keyVaultClient: any = null;

/**
 * Initialize Azure Key Vault client if configured
 */
async function initializeKeyVault(): Promise<any | null> {
  if (keyVaultClient !== null) {
    return keyVaultClient;
  }

  const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;
  if (!keyVaultUrl) {
    keyVaultClient = false; // Mark as not configured
    return null;
  }

  try {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    const { DefaultAzureCredential } = await import('@azure/identity');
    
    const credential = new DefaultAzureCredential();
    keyVaultClient = new SecretClient(keyVaultUrl, credential);
    return keyVaultClient;
  } catch (error) {
    console.warn('Failed to initialize Key Vault client:', error);
    keyVaultClient = false; // Mark as failed
    return null;
  }
}

/**
 * Get a secret value from Key Vault or environment variable
 * 
 * @param secretName - Name of the secret (Key Vault name or env var name)
 * @returns The secret value
 * @throws Error if secret is not found
 */
export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName)!;
  }

  // Try Key Vault if configured
  const client = await initializeKeyVault();
  if (client) {
    try {
      const secret = await client.getSecret(secretName);
      if (secret.value) {
        secretCache.set(secretName, secret.value);
        return secret.value;
      }
    } catch (error) {
      console.warn(`Failed to get secret "${secretName}" from Key Vault:`, error);
      // Fall through to environment variable
    }
  }

  // Fallback to environment variable
  const envValue = process.env[secretName];
  if (!envValue) {
    throw new Error(`Secret "${secretName}" not found in Key Vault or environment variables`);
  }

  // Cache the value
  secretCache.set(secretName, envValue);
  return envValue;
}

/**
 * Clear the secret cache (useful for testing or when secrets are rotated)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Preload secrets into cache (useful for batch loading)
 */
export async function preloadSecrets(secretNames: string[]): Promise<void> {
  await Promise.all(
    secretNames.map(name => 
      getSecret(name).catch(err => {
        console.warn(`Failed to preload secret "${name}":`, err);
      })
    )
  );
}

