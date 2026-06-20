import { GoogleGenAI } from "@google/genai";

import { env } from "@/lib/env";

type BuildActorInputArgs = {
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

export function hasValidGeminiApiKeyFormat(apiKey: string) {
  return /^AIza[\w-]{20,}$/.test(apiKey);
}

export function buildLinkedInActorInput(args: BuildActorInputArgs) {
  const selectedRoles = args.roles?.filter((role) => role.trim()) ?? [];
  const techStack = args.techStack?.filter((technology) => technology.trim()) ?? [];
  const selectedRoleQueries = selectedRoles.flatMap((role) => roleAliases[role] ?? [role]);
  const selectedTechnologyQueries = techStack.flatMap((technology) =>
    technologyAliases[technology] ?? [technology],
  );
  const queries = techStack.length
    ? selectedRoleQueries.length
      ? selectedRoleQueries.flatMap((role) => techStack.map((technology) => `${role} ${technology}`))
      : selectedTechnologyQueries
    : selectedRoleQueries.length ? selectedRoleQueries : [args.query];
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

    return `https://www.linkedin.com/jobs/search/?${parameters.toString()}`;
  };
  const locationUrls = locations.length
    ? locations.flatMap((location) => uniqueQueries.map((keywords) => buildUrl(keywords, location)))
    : args.remoteOnly ? [] : uniqueQueries.map((keywords) => buildUrl(keywords));
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
    scrapeCompany: true,
    splitByLocation: false,
  };
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
