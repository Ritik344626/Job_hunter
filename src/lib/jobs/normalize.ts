export type NormalizedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string | null;
  datePosted: string | null;
  employmentType: string | null;
  isRemote: boolean;
  salary: string | null;
  source: "linkedin";
};

type JobRecord = Record<string, unknown>;

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readPath(record: JobRecord, path: string) {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const match = Object.entries(value as JobRecord).find(
      ([key]) => normalizeKey(key) === normalizeKey(segment),
    );

    return match?.[1];
  }, record);
}

function firstText(record: JobRecord, paths: string[]) {
  for (const path of paths) {
    const value = readPath(record, path);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      const text = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join(" – ");

      if (text) {
        return text;
      }
    }
  }

  return null;
}

function firstBoolean(record: JobRecord, paths: string[]) {
  for (const path of paths) {
    const value = readPath(record, path);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return ["true", "yes", "remote"].includes(value.trim().toLowerCase());
    }
  }

  return false;
}

function fallbackId(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `linkedin-${(hash >>> 0).toString(36)}`;
}

export function normalizeLinkedInJob(record: JobRecord): NormalizedJob {
  const title = firstText(record, ["title", "jobTitle", "job_title", "position"]) ?? "Untitled role";
  const company = firstText(record, ["companyName", "company_name", "company.name", "company", "organization"]) ?? "Company not provided";
  const location = firstText(record, ["location", "jobLocation", "job_location", "formattedLocation"]);
  const url = firstText(record, ["jobUrl", "job_url", "applyUrl", "apply_url", "url", "link"]);
  const sourceId = firstText(record, ["id", "jobId", "job_id", "linkedinJobId"]);

  return {
    id: sourceId ?? fallbackId(`${title}|${company}|${location ?? ""}|${url ?? ""}`),
    title,
    company,
    location,
    url,
    description: firstText(record, ["description", "descriptionText", "jobDescription", "job_description", "summary"]),
    datePosted: firstText(record, ["datePosted", "date_posted", "postedAt", "listedAt", "publishedAt"]),
    employmentType: firstText(record, ["employmentType", "employment_type", "jobType", "job_type"]),
    isRemote:
      firstBoolean(record, ["isRemote", "is_remote", "remote"]) ||
      location?.toLowerCase().includes("remote") === true,
    salary: firstText(record, ["salary", "salaryInfo", "salaryRange", "salary_range", "compensation"]),
    source: "linkedin",
  };
}

export function normalizeLinkedInJobs(items: JobRecord[]) {
  const seenIds = new Set<string>();

  return items.filter((item): item is JobRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))).map(normalizeLinkedInJob).filter((job) => {
    if (seenIds.has(job.id)) {
      return false;
    }

    seenIds.add(job.id);
    return true;
  });
}
