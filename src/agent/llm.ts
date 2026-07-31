import { AzureChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export function azureModelFromEnv(): BaseChatModel | null {
  // LLM calls are server-side. Never fall back to browser-visible credentials.
  const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
    || process.env.OPENAI_MODEL
    || 'gpt-5.4-mini';

  if (apiKey && baseUrl) {
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION
      || '2025-04-01-preview';
    // AzureChatOpenAI expects the resource instance name, not the full URL
    let instanceName = baseUrl;
    try {
      const u = new URL(baseUrl);
      instanceName = u.hostname.split('.')[0] || baseUrl;
    } catch {}
    return new AzureChatOpenAI({
      azureOpenAIApiKey: apiKey,
      azureOpenAIApiInstanceName: instanceName,
      azureOpenAIApiDeploymentName: deployment,
      azureOpenAIApiVersion: apiVersion,
    });
  }

  // No Azure creds -> return null to force local-only
  return null;
}


