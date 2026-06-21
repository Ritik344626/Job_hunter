import type { NormalizedJob } from "@/lib/jobs/normalize";

type SearchFilters = {
  roles?: string[];
  locations?: string[];
  techStack?: string[];
  remoteOnly?: boolean;
};

type JobMatch = {
  match: boolean;
  matchScore: number;
};

const technologyKeywords: Record<string, string[]> = {
  "MERN Stack": ["mern", "mongodb", "express", "react", "node.js", "nodejs"],
  "MEAN Stack": ["mean", "mongodb", "express", "angular", "node.js", "nodejs"],
  "Java / Spring Boot": ["java", "spring boot", "spring"],
  "Python / Django": ["python", "django"],
  "Python / FastAPI": ["python", "fastapi"],
  ".NET / C#": [".net", "dotnet", "c#", "asp.net"],
  "React / Next.js": ["react", "next.js", "nextjs"],
  "PHP / Laravel": ["php", "laravel"],
  "Ruby on Rails": ["ruby", "rails"],
  "Go / Golang": ["golang", "go"],
  "Android / Kotlin": ["android", "kotlin"],
  "iOS / Swift": ["ios", "swift"],
  "GenAI / LLM": ["generative ai", "genai", "llm", "rag", "large language model"],
};

const ignoredRoleWords = new Set([
  "and",
  "developer",
  "engineer",
  "focused",
  "of",
  "the",
]);

function normalize(value: string | null | undefined) {
  return value?.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ") ?? "";
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function roleMatches(title: string, fullText: string, role: string) {
  const normalizedRole = normalize(role).trim();

  if (normalizedRole && title.includes(normalizedRole)) {
    return true;
  }

  const keywords = normalizedRole.split(" ").filter((word) => word.length > 2 && !ignoredRoleWords.has(word));
  const matches = keywords.filter((keyword) => title.includes(keyword) || fullText.includes(keyword));
  return matches.length >= Math.min(2, keywords.length);
}

function locationMatches(jobLocation: string | null, locations: string[]) {
  const normalizedLocation = normalize(jobLocation);
  return locations.some((location) => {
    const city = normalize(location).split(" ")[0];
    return city.length > 2 && normalizedLocation.includes(city);
  });
}

export function scoreJobAgainstFilters(job: NormalizedJob, filters: SearchFilters): JobMatch {
  const title = normalize(job.title);
  const fullText = normalize(`${job.title} ${job.description ?? ""}`);
  const selectedRoles = filters.roles?.filter(Boolean) ?? [];
  const selectedStacks = filters.techStack?.filter(Boolean) ?? [];
  const selectedLocations = filters.locations?.filter(Boolean) ?? [];
  let score = 30;

  if (selectedRoles.length) {
    const matchingRoles = selectedRoles.filter((role) => roleMatches(title, fullText, role));
    score += matchingRoles.length ? 30 : 5;
  } else {
    score += 15;
  }

  if (selectedStacks.length) {
    const matchingStacks = selectedStacks.filter((stack) =>
      containsAny(fullText, technologyKeywords[stack] ?? [normalize(stack)]),
    );
    score += Math.round((matchingStacks.length / selectedStacks.length) * 35);
  } else {
    score += 15;
  }

  if (selectedLocations.length) {
    if (locationMatches(job.location, selectedLocations)) {
      score += 15;
    } else if (filters.remoteOnly && job.isRemote) {
      score += 10;
    }
  } else if (filters.remoteOnly && job.isRemote) {
    score += 15;
  } else {
    score += 10;
  }

  const matchScore = Math.max(20, Math.min(98, score));

  return {
    match: matchScore >= 60,
    matchScore,
  };
}
