#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.PORTFOLIO_REPO ?? "Suraj370/surajpanda";
const BRANCH = process.env.PORTFOLIO_BRANCH ?? "main";
const DATA_DIR = process.env.PORTFOLIO_DATA_DIR ?? "src/data";

// ---------- GitHub contents API ----------

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function readJson(file: string): Promise<{ data: any; sha: string }> {
  const r = await gh(`/repos/${REPO}/contents/${DATA_DIR}/${file}?ref=${BRANCH}`);
  return { data: JSON.parse(Buffer.from(r.content, "base64").toString("utf8")), sha: r.sha };
}

/** Apply `fn` to a data file. Without confirm: return a before/after preview. With confirm: commit. */
async function mutate(file: string, message: string, confirm: boolean | undefined, fn: (d: any) => void) {
  const { data, sha } = await readJson(file);
  const before = JSON.stringify(data, null, 2);
  fn(data);
  const after = JSON.stringify(data, null, 2);
  if (before === after) return text("No changes: the result is identical to the current content.");
  if (!confirm) {
    return text(`PREVIEW (nothing committed). Call again with confirm: true to commit "${message}".\n\n--- ${file} after ---\n${after}`);
  }
  const r = await gh(`/repos/${REPO}/contents/${DATA_DIR}/${file}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      sha,
      branch: BRANCH,
      content: Buffer.from(after + "\n", "utf8").toString("base64"),
    }),
  });
  return text(`Committed to ${REPO}@${BRANCH}: ${r.commit.html_url}`);
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
function find<T>(list: T[], pred: (x: T) => boolean, label: string): number {
  const i = list.findIndex(pred);
  if (i < 0) throw new Error(`${label} not found`);
  return i;
}

// ---------- schemas ----------

const confirm = z.boolean().optional().describe("false/omitted = preview only; true = commit and push");

const projectFields = {
  description: z.string(),
  url: z.string().url(),
  kind: z.string().optional().describe("Short subtitle, e.g. 'DAG workflow orchestrator'. Required for featured projects."),
  tags: z.array(z.string()).optional(),
  snippet: z.array(z.string()).max(3).optional().describe("Up to 3 terminal-style lines for the featured card"),
};

const experienceFields = {
  title: z.string(),
  type: z.string().describe("e.g. Internship, Full-time"),
  dates: z.string().describe("e.g. 'Apr 2025 — Jul 2025 · 4 mos'"),
  location: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
};

// ---------- server ----------

const server = new McpServer({ name: "portfolio", version: "0.1.0" });

server.registerTool(
  "get_content",
  {
    description: "Read current portfolio content for a section.",
    inputSchema: { section: z.enum(["projects", "experience", "skills", "contact"]) },
  },
  async ({ section }) => text(JSON.stringify((await readJson(`${section}.json`)).data, null, 2)),
);

server.registerTool(
  "draft_from_repo",
  {
    description:
      "Fetch a public GitHub repo's description, topics, languages and README so you can write a project entry. Does not modify the portfolio.",
    inputSchema: { repo_url: z.string().url() },
  },
  async ({ repo_url }) => {
    const m = repo_url.match(/github\.com\/([^/]+\/[^/#?]+)/);
    if (!m) throw new Error("Not a GitHub repo URL");
    const slug = m[1].replace(/\.git$/, "");
    const [meta, langs, readme] = await Promise.all([
      gh(`/repos/${slug}`),
      gh(`/repos/${slug}/languages`),
      gh(`/repos/${slug}/readme`, { headers: { Accept: "application/vnd.github.raw+json" } }).catch(() => ""),
    ]);
    return text(
      JSON.stringify({ name: meta.name, description: meta.description, homepage: meta.homepage, topics: meta.topics, languages: Object.keys(langs), url: meta.html_url }, null, 2) +
        `\n\nREADME (truncated):\n${String(readme).slice(0, 6000)}`,
    );
  },
);

server.registerTool(
  "add_project",
  {
    description: "Add a project. featured=true puts it in the large cards (needs kind, tags, snippet); otherwise it goes in the 'More' list.",
    inputSchema: { title: z.string(), featured: z.boolean().default(false), ...projectFields, confirm },
  },
  async ({ title, featured, description, url, kind, tags, snippet, confirm }) =>
    mutate("projects.json", `Add ${title} to projects`, confirm, (d) => {
      const all = [...d.featured, ...d.more];
      if (all.some((p) => same(p.title, title))) throw new Error(`"${title}" already exists; use update_project`);
      if (featured) {
        if (!kind || !tags?.length || !snippet?.length) throw new Error("Featured projects need kind, tags and snippet");
        d.featured.push({ title, kind, description, tags, url, snippet });
      } else {
        d.more.push({ title, description, url });
      }
    }),
);

server.registerTool(
  "update_project",
  {
    description: "Update fields of an existing project (matched by title). Only the provided fields change.",
    inputSchema: {
      title: z.string().describe("Current title"),
      new_title: z.string().optional(),
      description: projectFields.description.optional(),
      url: projectFields.url.optional(),
      kind: projectFields.kind,
      tags: projectFields.tags,
      snippet: projectFields.snippet,
      confirm,
    },
  },
  async ({ title, new_title, confirm, ...fields }) =>
    mutate("projects.json", `Update ${title} in projects`, confirm, (d) => {
      const list = [...d.featured, ...d.more];
      const p = list[find(list, (x) => same(x.title, title), `Project "${title}"`)];
      if (new_title) p.title = new_title;
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) p[k] = v;
    }),
);

server.registerTool(
  "remove_project",
  { description: "Remove a project by title.", inputSchema: { title: z.string(), confirm } },
  async ({ title, confirm }) =>
    mutate("projects.json", `Remove ${title} from projects`, confirm, (d) => {
      for (const key of ["featured", "more"]) {
        const i = d[key].findIndex((p: any) => same(p.title, title));
        if (i >= 0) return void d[key].splice(i, 1);
      }
      throw new Error(`Project "${title}" not found`);
    }),
);

server.registerTool(
  "move_project",
  {
    description: "Reorder a project within its list, or promote/demote it between featured and More.",
    inputSchema: { title: z.string(), position: z.number().int().min(0).describe("0-based index in target list"), confirm },
  },
  async ({ title, position, confirm }) =>
    mutate("projects.json", `Reorder ${title} in projects`, confirm, (d) => {
      for (const key of ["featured", "more"]) {
        const i = d[key].findIndex((p: any) => same(p.title, title));
        if (i >= 0) {
          const [p] = d[key].splice(i, 1);
          d[key].splice(position, 0, p);
          return;
        }
      }
      throw new Error(`Project "${title}" not found`);
    }),
);

server.registerTool(
  "add_experience",
  {
    description: "Add a role. New roles are placed first (most recent on top) unless position is given.",
    inputSchema: { company: z.string(), ...experienceFields, position: z.number().int().min(0).optional(), confirm },
  },
  async ({ position, confirm, ...role }) =>
    mutate("experience.json", `Add ${role.title} at ${role.company} to experience`, confirm, (d) => {
      if (d.some((r: any) => same(r.company, role.company) && same(r.title, role.title))) {
        throw new Error("That role already exists; use update_experience");
      }
      d.splice(position ?? 0, 0, role);
    }),
);

server.registerTool(
  "update_experience",
  {
    description: "Update a role matched by company (and title if the company has several). Only provided fields change.",
    inputSchema: {
      company: z.string(),
      title: z.string().optional().describe("Current title, to disambiguate"),
      new_company: z.string().optional(),
      new_title: z.string().optional(),
      type: experienceFields.type.optional(),
      dates: experienceFields.dates.optional(),
      location: experienceFields.location.optional(),
      summary: experienceFields.summary.optional(),
      skills: experienceFields.skills.optional(),
      confirm,
    },
  },
  async ({ company, title, new_company, new_title, confirm, ...fields }) =>
    mutate("experience.json", `Update ${company} in experience`, confirm, (d) => {
      const r = d[find(d, (x: any) => same(x.company, company) && (!title || same(x.title, title)), `Role at "${company}"`)];
      if (new_company) r.company = new_company;
      if (new_title) r.title = new_title;
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) r[k] = v;
    }),
);

server.registerTool(
  "remove_experience",
  {
    description: "Remove a role by company (and title if needed).",
    inputSchema: { company: z.string(), title: z.string().optional(), confirm },
  },
  async ({ company, title, confirm }) =>
    mutate("experience.json", `Remove ${company} from experience`, confirm, (d) => {
      d.splice(find(d, (x: any) => same(x.company, company) && (!title || same(x.title, title)), `Role at "${company}"`), 1);
    }),
);

server.registerTool(
  "add_skills",
  {
    description: "Add skills to a group, creating the group if it doesn't exist.",
    inputSchema: { group: z.string(), items: z.array(z.string()).min(1), confirm },
  },
  async ({ group, items, confirm }) =>
    mutate("skills.json", `Add skills to ${group}`, confirm, (d) => {
      let g = d.find((x: any) => same(x.title, group));
      if (!g) d.push((g = { title: group, items: [] }));
      for (const it of items) if (!g.items.some((s: string) => same(s, it))) g.items.push(it);
    }),
);

server.registerTool(
  "remove_skills",
  {
    description: "Remove skills from a group. Removes the group if it ends up empty.",
    inputSchema: { group: z.string(), items: z.array(z.string()).min(1), confirm },
  },
  async ({ group, items, confirm }) =>
    mutate("skills.json", `Remove skills from ${group}`, confirm, (d) => {
      const i = find(d, (x: any) => same(x.title, group), `Skill group "${group}"`);
      d[i].items = d[i].items.filter((s: string) => !items.some((it) => same(s, it)));
      if (!d[i].items.length) d.splice(i, 1);
    }),
);

server.registerTool(
  "update_contact",
  {
    description: "Update the contact email, or add/replace a social link (matched by label).",
    inputSchema: {
      email: z.string().email().optional(),
      link: z.object({ label: z.string(), handle: z.string(), href: z.string().url() }).optional(),
      confirm,
    },
  },
  async ({ email, link, confirm }) =>
    mutate("contact.json", "Update contact", confirm, (d) => {
      if (email) d.email = email;
      if (link) {
        const i = d.links.findIndex((l: any) => same(l.label, link.label));
        if (i >= 0) d.links[i] = link;
        else d.links.push(link);
      }
    }),
);

await server.connect(new StdioServerTransport());
