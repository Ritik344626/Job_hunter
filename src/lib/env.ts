import { z } from "zod";

const publicEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
    APIFY_LINKEDIN_ACTOR_ID: z
        .string()
        .min(1)
        .default("curious_coder/linkedin-jobs-scraper"),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    GEMINI_JOB_SCREENING_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    INTEGRATION_ENCRYPTION_KEY: z.string().min(1).optional(),
});

const rawEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    APIFY_LINKEDIN_ACTOR_ID: process.env.APIFY_LINKEDIN_ACTOR_ID,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_JOB_SCREENING_ENABLED: process.env.GEMINI_JOB_SCREENING_ENABLED,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
};

const parsedPublic = publicEnvSchema.safeParse(rawEnv);
const parsedServer = serverEnvSchema.safeParse(rawEnv);

if (!parsedPublic.success || !parsedServer.success) {
    const publicIssues = parsedPublic.success
        ? []
        : parsedPublic.error.issues.map((issue) => issue.path.join("."));
    const serverIssues = parsedServer.success
        ? []
        : parsedServer.error.issues.map((issue) => issue.path.join("."));

    throw new Error(
        `Invalid environment variables: ${[...publicIssues, ...serverIssues].join(", ")}`,
    );
}

export const env = {
    ...parsedPublic.data,
    ...parsedServer.data,
};
