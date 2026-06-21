import { GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";

export type BuildActorInputArgs = {
  query: string;
  roles?: string[];
  location?: string;
  locations?: string[];
  techStack?: string[];
  remoteOnly?: boolean;
  postedWithin?: string;
  experienceLevel?: string;
  maxItems?: number;
};

type JobEvaluation = {
  id: string;
  match: boolean;
  score: number;
};

const roleAliases: Record<string, string[]> = {
  "AI-Focused Full Stack Developer": [
    "Full Stack AI Engineer",
    "AI Full Stack Developer",
    "AI Software Engineer",
    "Generative AI Full Stack Engineer",
    "LLM Full Stack Engineer",
  ],
  "AI Application Engineer": [
    "AI Application Engineer",
    "AI App Developer",
    "AI Software Engineer",
    "LLM Application Engineer",
    "Generative AI Engineer",
  ],
  "Generative AI Engineer": [
    "Generative AI Engineer",
    "GenAI Engineer",
    "AI Engineer",
    "LLM Engineer",
  ],
  "LLM Engineer": [
    "LLM Engineer",
    "Generative AI Engineer",
    "AI Engineer",
    "RAG Engineer",
  ],
  "Machine Learning Engineer": [
    "Machine Learning Engineer",
    "ML Engineer",
    "Applied Machine Learning Engineer",
  ],
  "Full Stack Developer": ["Full Stack Developer", "Full Stack Engineer"],
  "Backend Developer": ["Backend Developer", "Backend Engineer"],
  "Frontend Developer": ["Frontend Developer", "Front End Developer"],
  "Software Engineer": ["Software Engineer", "Software Developer"],
  "DevOps Engineer": ["DevOps Engineer", "Platform Engineer"],
  "Cloud Engineer": ["Cloud Engineer", "Cloud Infrastructure Engineer"],
};

const technologyAliases: Record<string, string[]> = {
  "MERN Stack": ["MERN Developer", "MERN Stack Developer"],
  "MEAN Stack": ["MEAN Developer", "MEAN Stack Developer"],
  "Java / Spring Boot": ["Java Developer", "Spring Boot Developer"],
  "Python / Django": ["Python Developer", "Django Developer"],
  "Python / FastAPI": ["Python FastAPI Developer", "FastAPI Developer"],
  ".NET / C#": [".NET Developer", "C# Developer"],
  "React / Next.js": ["React Developer", "Next.js Developer"],
  "PHP / Laravel": ["PHP Developer", "Laravel Developer"],
  "Ruby on Rails": ["Ruby on Rails Developer"],
  "Go / Golang": ["Golang Developer", "Go Developer"],
  "Android / Kotlin": ["Android Developer", "Kotlin Developer"],
  "iOS / Swift": ["iOS Developer", "Swift Developer"],
  "GenAI / LLM": ["Generative AI Engineer", "LLM Engineer", "RAG Engineer"],
};

function isJobEvaluation(value: unknown): value is JobEvaluation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const evaluation = value as Record<string, unknown>;
  return typeof evaluation.id === "string"
    && typeof evaluation.match === "boolean"
    && typeof evaluation.score === "number";
}

export function hasValidGeminiApiKeyFormat(apiKey: string) {
  return apiKey.trim().length >= 10;
}

import type { NormalizedJob } from "@/lib/jobs/normalize";

export async function buildLinkedInActorInput(
  geminiApiKey: string,
  args: BuildActorInputArgs,
) {
  let queries: string[] = [];

  // Try to use Gemini to generate highly optimized search terms
  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const prompt = `You are a professional job search query optimizer.
Analyze the user's job search preferences:
- Target Roles: ${args.roles?.join(", ") || "Any"}
- Tech Stack: ${args.techStack?.join(", ") || "Any"}
- Locations: ${args.locations?.join(", ") || "Any"}
- Experience Level: ${args.experienceLevel || "Any"}
- Remote Only: ${args.remoteOnly ? "Yes" : "No"}

Generate up to 3 highly optimized, distinct search query strings (keywords) for LinkedIn jobs.
If target roles and a tech stack are both provided, generate combinations of roles and tech stack keywords (for example, combining "Full Stack Developer" and "React/Node" into "Full Stack Developer React Node.js", "Backend Engineer Node.js", "FastAPI Developer").
Do not include location name or remote status inside the keywords themselves (they are filtered using URL parameters).
Keep each query concise (usually 2-5 words).

Respond with a JSON object in this format:
{
  "queries": ["query 1", "query 2", ...]
}`;

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
        queries = parsed.queries.map((q: unknown) => String(q));
      }
    }
  } catch (error) {
    console.error("Gemini search query generation failed, using manual fallback:", error);
  }

  // Fallback to manual aliasing if Gemini fails or returns empty queries
  if (!queries.length) {
    const selectedRoles = args.roles?.filter((role) => role.trim()) ?? [];
    const techStack = args.techStack?.filter((technology) => technology.trim()) ?? [];
    const selectedRoleQueries = selectedRoles.flatMap((role) => roleAliases[role] ?? [role]);
    const selectedTechnologyQueries = techStack.flatMap((technology) =>
      technologyAliases[technology] ?? [technology],
    );
    const fallbackQueries = techStack.length
      ? selectedRoleQueries.length
        ? selectedRoleQueries.flatMap((role) => techStack.map((technology) => `${role} ${technology}`))
        : selectedTechnologyQueries
      : selectedRoleQueries.length ? selectedRoleQueries : [args.query];
    queries = [...new Set(fallbackQueries)];
  }

  const uniqueQueries = [...new Set(queries)];
  const locations = args.locations?.filter((location) => location.trim())
    ?? (args.location ? [args.location] : []);
  const dateFilters: Record<string, string> = {
    "Past 24 hours": "r86400",
    "Past 3 days": "r259200",
    "Past week": "r604800",
    "Past 2 weeks": "r1209600",
    "Past month": "r2592000",
  };
  const experienceFilters: Record<string, string> = {
    "Fresher (0–2 years)": "1,2",
    "2–3 years": "2,3",
    "3–5 years": "3,4",
    "5+ years": "4,5,6",
  };
  const experienceLevel = experienceFilters[args.experienceLevel ?? ""];
  const postedWithin = dateFilters[args.postedWithin ?? ""];

  const buildUrl = (keywords: string, location?: string, remote = false) => {
    const parameters = new URLSearchParams({ keywords });

    if (location) {
      parameters.set("location", location);
    }

    if (remote) {
      parameters.set("f_WT", "2");
    }

    if (experienceLevel) {
      parameters.set("f_E", experienceLevel);
    }

    if (postedWithin) {
      parameters.set("f_TPR", postedWithin);
    }

    const queryString = parameters.toString().replace(/\+/g, "%20");
    return `https://www.linkedin.com/jobs/search/?${queryString}`;
  };

  const locationUrls = locations.length
    ? locations.flatMap((location) => uniqueQueries.map((keywords) => buildUrl(keywords, location, false)))
    : uniqueQueries.map((keywords) => buildUrl(keywords, undefined, false));

  const remoteUrls = args.remoteOnly
    ? uniqueQueries.map((keywords) => buildUrl(keywords, "India", true))
    : [];

  const urls = [...new Set([...locationUrls, ...remoteUrls])].slice(0, 25);

  if (!urls.length) {
    throw new Error("No LinkedIn search URL could be created.");
  }

  return {
    urls,
    count: Math.min(100, Math.max(10, args.maxItems ?? 25)),
    scrapeCompany: false,
    splitByLocation: false,
  };
}

export async function evaluateJobsWithGemini(
  geminiApiKey: string,
  jobs: NormalizedJob[],
  filters: BuildActorInputArgs,
): Promise<JobEvaluation[]> {
  if (!jobs.length) {
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const jobsToEvaluate = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    isRemote: job.isRemote,
    description: job.description ? job.description.slice(0, 500) : "No description",
  }));
  const prompt = `You are a job screening assistant. Evaluate the following job postings against the user's search preferences.

User Search Preferences:
- Target Roles: ${filters.roles?.join(", ") || "Any"}
- Tech Stack: ${filters.techStack?.join(", ") || "Any"}
- Target Locations: ${filters.locations?.join(", ") || "Any"}
- Location & Remote Rule: ${
      filters.remoteOnly
        ? "Accepts jobs that are EITHER remote (anywhere) OR located in the target locations."
        : "Jobs must be in the target locations (remote is acceptable if located in the target location, but remote jobs from other locations are not matches)."
    }
- Experience Level: ${filters.experienceLevel || "Any"}

For each job listing, return:
1. "match": true if it matches target roles, technology preferences, location, and remote requirements. false if it's completely irrelevant, requires a different profile, or violates remote/experience constraints.
2. "score": 0-100 indicating fit (80+ = high match, 60-79 = moderate match, <60 = low/no match).

Jobs:
${JSON.stringify(jobsToEvaluate, null, 2)}

Respond with a JSON object in this exact format:
{
  "evaluations": [
    {
      "id": "job_id",
      "match": true,
      "score": 90
    },
    ...
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });
    const parsed: unknown = response.text ? JSON.parse(response.text.trim()) : null;
    const evaluations = parsed && typeof parsed === "object" && Array.isArray((parsed as { evaluations?: unknown }).evaluations)
      ? (parsed as { evaluations: unknown[] }).evaluations
      : [];
    const evaluationsById = new Map(
      evaluations.filter(isJobEvaluation).map((evaluation) => [evaluation.id, evaluation]),
    );

    return jobs.map((job) => evaluationsById.get(job.id) ?? {
      id: job.id,
      match: true,
      score: 75,
    });
  } catch (error) {
    console.error("Gemini job screening failed:", error);
    return jobs.map((job) => ({
      id: job.id,
      match: true,
      score: 75,
    }));
  }
}

export async function validateGeminiApiKey(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

  await ai.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: "Reply with OK.",
    config: {
      maxOutputTokens: 4,
    },
  });
}
