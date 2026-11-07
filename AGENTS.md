<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- Claim narrative AI runs server-side in src/lib/claim-ai.functions.ts via Lovable AI Gateway; on AI failure the claim is routed to manual review, never simulated (no external workflow engine in the critical path).
- Reviewer session state uses one shared provider; the public workspace retains demo access while analysis requires authenticated server middleware to protect AI usage.
- Claim analysis and human decisions save through security-invoker database functions, atomically with append-only audit events, so records cannot partially commit; database RLS scopes access to the signed-in reviewer.
- Claim evidence files live in the private claim-evidence bucket under <user_id>/<claim_uuid>/, so storage policies can scope access to the owning reviewer.
- Evidence viewing uses short-lived signed URLs obtained on demand through the existing storage client; never expose private bucket files through public URLs.
- Independent approval is assigned explicitly to a different registered reviewer; database triggers enforce immutable signoffs and append their audit events atomically, with narrowly scoped assigned-reviewer RLS.
- Dealer analytics aggregates all owner-submitted saved claims through the paginated shared storage reader; assigned claims are excluded to avoid double-counting exposure.
- Account settings use the shared reviewer provider and owner-scoped client reads; role assignments are stored separately and are read-only to reviewers to prevent self-promotion.
