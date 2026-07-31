'use client';

function StatusCard({
  name,
  detail,
  status = 'Managed by server',
}: {
  name: string;
  detail: string;
  status?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-[var(--text-primary)]">{name}</div>
          <div className="mt-1 text-sm text-[var(--text-tertiary)]">{detail}</div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-500">
          {status}
        </span>
      </div>
    </div>
  );
}

export function APISettings() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--accent-primary)]">
          API Connections
        </h3>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Long-lived credentials are stored in Azure Key Vault and are never sent to the browser.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <StatusCard name="Azure Speech" detail="West Europe - avatar, speech recognition, and neural voice synthesis" />
        <StatusCard name="Azure OpenAI" detail="Server-side agent model and streamed responses" />
        <StatusCard name="Azure AI Search" detail="Profile-isolated hybrid document retrieval" />
        <StatusCard name="Azure Blob Storage" detail="Private backgrounds, media, and source documents" />
      </div>
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-[var(--text-secondary)]">
        Resource endpoints, keys, deployments, and rotation are managed through App Service settings and Key Vault rather than per-preset fields.
      </div>
    </div>
  );
}
