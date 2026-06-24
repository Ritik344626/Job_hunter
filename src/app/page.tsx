"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

type IntegrationStatus = {
  hasGeminiKey: boolean;
  hasApifyToken: boolean;
  updatedAt: string | null;
};

type SearchRunStatus = "queued" | "running" | "screening" | "completed" | "failed";

type SearchRunResponse = {
  id: string;
  status: SearchRunStatus;
  jobsFound: number;
  error: string | null;
  items?: Record<string, unknown>[];
  isScreening?: boolean;
};

type SavedSearchFilters = {
  roles: string[];
  locations: string[];
  techStack: string[];
  remoteOnly: boolean;
  postedWithin: string;
  experienceLevel: string;
  maxItems: number;
};

type SavedSearch = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
};

type PipelineStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

type PipelineItem = {
  id: string;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  status: PipelineStatus;
  notes: string | null;
  follow_up_at: string | null;
};

type IntegrationProvider = "gemini" | "apify";

type IntegrationTestState = {
  status: "idle" | "testing" | "success" | "error";
  message: string | null;
};

type IconName =
  | "arrow"
  | "briefcase"
  | "check"
  | "chevron"
  | "eye"
  | "key"
  | "location"
  | "logout"
  | "search"
  | "sparkle"
  | "target";

const initialIntegrationStatus: IntegrationStatus = {
  hasGeminiKey: false,
  hasApifyToken: false,
  updatedAt: null,
};

const popularItRoles = [
  "Software Engineer",
  "AI-Focused Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Product Designer",
  "Product Manager",
  "Data Analyst",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Application Engineer",
  "Generative AI Engineer",
  "LLM Engineer",
  "MLOps Engineer",
  "AI Solutions Architect",
  "Prompt Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "QA Engineer",
  "Cybersecurity Engineer",
];

const popularIndianLocations = [
  "Bengaluru, Karnataka, India",
  "Hyderabad, Telangana, India",
  "Pune, Maharashtra, India",
  "Gurugram, Haryana, India",
  "Mumbai, Maharashtra, India",
  "Chennai, Tamil Nadu, India",
  "Noida, Uttar Pradesh, India",
  "Delhi, India",
  "Kochi, Kerala, India",
  "Ahmedabad, Gujarat, India",
];

const popularTechStacks = [
  "MERN Stack",
  "MEAN Stack",
  "Java / Spring Boot",
  "Python / Django",
  "Python / FastAPI",
  ".NET / C#",
  "React / Next.js",
  "Angular",
  "Node.js",
  "PHP / Laravel",
  "Ruby on Rails",
  "Go / Golang",
  "Flutter",
  "Android / Kotlin",
  "iOS / Swift",
  "GenAI / LLM",
];

const postedWithinOptions = [
  "Any time",
  "Past 24 hours",
  "Past 3 days",
  "Past week",
  "Past 2 weeks",
  "Past month",
];

const experienceLevelOptions = [
  "Any experience",
  "Fresher (0–2 years)",
  "2–3 years",
  "3–5 years",
  "5+ years",
];

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    briefcase: <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-12 0h16a1 1 0 0 1 1 1v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a1 1 0 0 1 1-1Zm-1 5h18" />,
    check: <path d="m5 12 4.2 4L19 6" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    key: <path d="M15.5 7.5a4.5 4.5 0 1 1-8.8 1.4L2.8 12.8v2.4h2.4v2.4H8v-2.4h2.4l.9-.9a4.5 4.5 0 0 1 4.2-6.8Zm1.5 0h.01" />,
    location: <path d="M12 21s7-5.3 7-12a7 7 0 1 0-14 0c0 6.7 7 12 7 12Zm0-9.5h.01" />,
    logout: <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5m4-4 4-3-4-3m4 3H8" />,
    search: <path d="m21 21-4.4-4.4m1.4-5.1a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />,
    sparkle: <path d="m12 3-1.2 4.2L7 8.5l3.8 1.3L12 14l1.2-4.2L17 8.5l-3.8-1.3L12 3ZM5 14l-.7 2.3L2 17l2.3.7L5 20l.7-2.3L8 17l-2.3-.7L5 14Zm14-1-.8 2.2L16 16l2.2.8L19 19l.8-2.2L22 16l-2.2-.8L19 13Z" />,
    target: <path d="M12 21a9 9 0 1 0-9-9m9 5a5 5 0 1 0-5-5m5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-1 7-7" />,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-slate-300"}`} />;
}

function SearchSelect({ allowCustom = false, icon, label, onChange, options, placeholder, value }: { allowCustom?: boolean; icon: IconName; label: string; onChange: (value: string) => void; options: string[]; placeholder: string; value: string; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(() => Boolean(value) && !options.includes(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.includes(value) ? value : "Other";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function chooseOption(option: string) {
    setIsCustom(false);
    onChange(option);
    setIsOpen(false);
  }

  function chooseCustom() {
    setIsCustom(true);
    onChange("");
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      {isCustom ? (
        <div className="search-select">
          <Icon className="h-5 w-5 shrink-0 text-slate-400" name={icon} />
          <input aria-label={label} autoFocus className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
          <button aria-label={`Choose a popular ${label.toLowerCase()}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={() => setIsOpen((current) => !current)} type="button"><Icon className="h-4 w-4" name="chevron" /></button>
        </div>
      ) : (
        <button aria-expanded={isOpen} className="search-select w-full" onClick={() => setIsOpen((current) => !current)} type="button">
          <Icon className="h-5 w-5 shrink-0 text-slate-400" name={icon} />
          <span className="min-w-0 flex-1 truncate text-left text-sm text-white">{selectedLabel}</span>
          <Icon className={`h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} name="chevron" />
        </button>
      )}
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(16rem,calc(100vw-3rem))] sm:min-w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#292b46] p-1.5 shadow-[0_22px_45px_-18px_rgba(0,0,0,.75)]">
          <p className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Popular {label}s</p>
          <div className="max-h-60 overflow-y-auto pr-1">
            {options.map((option) => <button className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left text-sm transition ${option === value ? "bg-violet-400/20 font-semibold text-white" : "text-slate-200 hover:bg-white/10"}`} key={option} onClick={() => chooseOption(option)} type="button"><span>{option}</span>{option === value ? <Icon className="h-4 w-4 text-violet-200" name="check" /> : null}</button>)}
          </div>
          {allowCustom ? <div className="mt-1 border-t border-white/10 pt-1"><button className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-semibold text-violet-200 transition hover:bg-white/10 hover:text-white" onClick={chooseCustom} type="button"><span className="grid h-5 w-5 place-items-center rounded-md bg-violet-400/20 text-sm">+</span>Other — type manually</button></div> : null}
        </div>
      ) : null}
    </div>
  );
}

function MultiSearchSelect({ customLabel, heading, icon, onChange, options, placeholder, values }: { customLabel: string; heading: string; icon: IconName; onChange: (values: string[]) => void; options: string[]; placeholder: string; values: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((selectedValue) => selectedValue !== value) : [...values, value]);
  }

  function addCustomValue() {
    const value = customValue.trim();

    if (value && !values.includes(value)) {
      onChange([...values, value]);
    }

    setCustomValue("");
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button aria-expanded={isOpen} className="search-select w-full" onClick={() => setIsOpen((current) => !current)} type="button">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" name={icon} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left">
          {values.length ? values.slice(0, 2).map((value) => <span className="max-w-36 truncate rounded-md bg-violet-400/20 px-2 py-1 text-xs font-semibold text-violet-100" key={value}>{value}</span>) : <span className="text-sm text-slate-400">{placeholder}</span>}
          {values.length > 2 ? <span className="shrink-0 text-xs font-semibold text-violet-200">+{values.length - 2}</span> : null}
        </span>
        <Icon className={`h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} name="chevron" />
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(20rem,calc(100vw-3rem))] sm:min-w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#292b46] p-1.5 shadow-[0_22px_45px_-18px_rgba(0,0,0,.75)]">
          <div className="flex items-center justify-between px-2.5 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">{heading}</p>{values.length ? <button className="text-xs font-semibold text-slate-300 transition hover:text-white" onClick={() => onChange([])} type="button">Clear all</button> : null}</div>
          <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
            {options.map((option) => {
              const selected = values.includes(option);
              return <button className={`flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm transition ${selected ? "bg-violet-400/20 font-semibold text-white" : "text-slate-200 hover:bg-white/10"}`} key={option} onClick={() => toggleValue(option)} type="button"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-violet-300 bg-violet-400 text-slate-950" : "border-slate-500"}`}>{selected ? <Icon className="h-3 w-3" name="check" /> : null}</span><span>{option}</span></button>;
            })}
          </div>
          <div className="mt-2 border-t border-white/10 p-1 pt-3"><p className="px-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">{customLabel}</p><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.07] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-violet-300" onChange={(event) => setCustomValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomValue(); } }} placeholder={placeholder} value={customValue} /><button className="rounded-xl bg-violet-300 px-3 text-sm font-bold text-slate-950 transition hover:bg-white" onClick={addCustomValue} type="button">Add</button></div></div>
        </div>
      ) : null}
    </div>
  );
}

function getJobValue(job: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = job[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function getJobMatchScore(job: Record<string, unknown>): number {
  let matchScore = typeof job.matchScore === "number" ? job.matchScore : undefined;
  if (matchScore === undefined && typeof job.match_score === "number") {
    matchScore = job.match_score;
  }
  if (matchScore === undefined) {
    const description = getJobValue(job, ["description", "jobDescription", "summary"]);
    if (typeof description === "string") {
      const matchRegex = /^\[Match Score:\s*(\d+)%\]/;
      const matchResult = matchRegex.exec(description);
      if (matchResult) {
        matchScore = parseInt(matchResult[1], 10);
      }
    }
  }
  return matchScore ?? 0;
}

function getSearchProgress(status: SearchRunStatus, isScreening = false) {
  if (isScreening) return 85;
  const progress = {
    queued: 15,
    running: 60,
    screening: 85,
    completed: 100,
    failed: 100,
  };

  return progress[status];
}

function getSearchStage(status: SearchRunStatus, isScreening = false) {
  if (isScreening) return "AI is screening and scoring matches";
  const stage = {
    queued: "Preparing your LinkedIn search",
    running: "Apify is collecting live roles",
    screening: "AI is screening and scoring matches",
    completed: "Search complete",
    failed: "Search needs attention",
  };

  return stage[status];
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [apifyApiToken, setApifyApiToken] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTechStack, setSelectedTechStack] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [postedWithin, setPostedWithin] = useState("Any time");
  const [experienceLevel, setExperienceLevel] = useState("Any experience");
  const [maxItems, setMaxItems] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState("Ready when you are.");
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(initialIntegrationStatus);
  const [integrationTests, setIntegrationTests] = useState<Record<IntegrationProvider, IntegrationTestState>>({
    gemini: { status: "idle", message: null },
    apify: { status: "idle", message: null },
  });
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [activeSearch, setActiveSearch] = useState<SearchRunResponse | null>(null);
  const [activeView, setActiveView] = useState<"search" | "saved" | "pipeline">("search");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [openedJobIds, setOpenedJobIds] = useState<string[]>([]);
  const [hideViewed, setHideViewed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const stored = localStorage.getItem("opened_jobs");
    if (stored) {
      try {
        setOpenedJobIds(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleJobOpened = useCallback((jobId: string) => {
    if (!jobId) return;
    setOpenedJobIds((prev) => {
      if (prev.includes(jobId)) return prev;
      const next = [...prev, jobId];
      localStorage.setItem("opened_jobs", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [jobs, hideViewed]);

  const sortedJobs = useMemo(() => {
    const jobsCopy = [...jobs];
    return jobsCopy.sort((a, b) => getJobMatchScore(b) - getJobMatchScore(a));
  }, [jobs]);

  const displayedJobs = useMemo(() => {
    let filtered = sortedJobs;
    if (hideViewed) {
      filtered = filtered.filter((job) => {
        const jobId = (getJobValue(job, ["id", "url", "jobUrl"]) as string) ?? "";
        return !openedJobIds.includes(jobId);
      });
    }
    return filtered;
  }, [sortedJobs, hideViewed, openedJobIds]);

  const totalPages = Math.ceil(displayedJobs.length / itemsPerPage);
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayedJobs.slice(startIndex, startIndex + itemsPerPage);
  }, [displayedJobs, currentPage]);

  const integrationsReady = integrationStatus.hasGeminiKey && integrationStatus.hasApifyToken;
  const firstName = user?.user_metadata.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";
  const activeSearchId = activeSearch?.id;
  const activeSearchStatus = activeSearch?.status;

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      setIsLoading(false);
    }

    void loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    async function fetchIntegrationStatus() {
      if (!user) {
        setIntegrationStatus(initialIntegrationStatus);
        return;
      }

      const response = await fetch("/api/integrations");
      if (response.ok) {
        setIntegrationStatus((await response.json()) as IntegrationStatus);
      }
    }

    void fetchIntegrationStatus();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    async function loadWorkspace() {
      const [savedResponse, pipelineResponse] = await Promise.all([
        fetch("/api/saved-searches"),
        fetch("/api/pipeline"),
      ]);

      if (savedResponse.ok) {
        const data = (await savedResponse.json()) as { searches: SavedSearch[] };
        setSavedSearches(data.searches);
      }

      if (pipelineResponse.ok) {
        const data = (await pipelineResponse.json()) as { items: PipelineItem[] };
        setPipelineItems(data.items);
      }
    }

    void loadWorkspace();
  }, [user]);

  useEffect(() => {
    if (!activeSearchId || !activeSearchStatus || ["completed", "failed"].includes(activeSearchStatus)) {
      return;
    }

    let isCancelled = false;

    async function pollSearch() {
      try {
        const response = await fetch(`/api/jobs/searches/${activeSearchId}`);
        const data = (await response.json()) as SearchRunResponse & { error?: string };

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setActiveSearch((current) => current ? { ...current, status: "failed", error: data.error ?? "We could not check this search." } : current);
          setIsSearching(false);
          setStatus(data.error ?? "We could not check this search.");
          return;
        }

        setActiveSearch(data);

        if (data.status === "completed") {
          setJobs(data.items ?? []);
          setIsSearching(false);
          setStatus(`Search complete — ${data.jobsFound} fresh roles found.`);
        } else if (data.status === "failed") {
          setIsSearching(false);
          setStatus(data.error ?? "This search could not be completed.");
        } else {
          setStatus(getSearchStage(data.status));
        }
      } catch {
        if (!isCancelled) {
          setActiveSearch((current) => current ? { ...current, status: "failed", error: "We could not check this search." } : current);
          setIsSearching(false);
          setStatus("We could not check this search.");
        }
      }
    }

    void pollSearch();
    const interval = window.setInterval(() => void pollSearch(), 3000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [activeSearchId, activeSearchStatus]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isSignUp = authMode === "signup";
    setStatus(isSignUp ? "Creating your workspace..." : "Signing you in...");

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(isSignUp ? "Account created. Check your inbox to confirm your email." : "Welcome back — your workspace is ready.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setJobs([]);
    setActiveSearch(null);
    setSavedSearches([]);
    setPipelineItems([]);
    setStatus("You have been signed out.");
  }

  async function saveIntegrations() {
    if (!geminiApiKey && !apifyApiToken) {
      setStatus("Add at least one API key before saving.");
      return;
    }

    setIsSaving(true);
    setStatus("Saving your credentials...");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(geminiApiKey ? { geminiApiKey } : {}),
          ...(apifyApiToken ? { apifyApiToken } : {}),
        }),
      });
      const data = (await response.json()) as IntegrationStatus & { error?: string };

      if (!response.ok) {
        setStatus(data.error ?? "We could not save your credentials.");
        return;
      }

      setIntegrationStatus(data);
      setGeminiApiKey("");
      setApifyApiToken("");
      setIntegrationTests({
        gemini: { status: "idle", message: null },
        apify: { status: "idle", message: null },
      });
      setShowSettings(false);
      setStatus("Integrations connected. You can start a focused search now.");
    } catch {
      setStatus("We could not connect to the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function testIntegration(provider: IntegrationProvider) {
    const apiKey = provider === "gemini" ? geminiApiKey : apifyApiToken;

    if (!apiKey) {
      setIntegrationTests((current) => ({
        ...current,
        [provider]: { status: "error", message: "Enter a credential to test it." },
      }));
      return;
    }

    setIntegrationTests((current) => ({
      ...current,
      [provider]: { status: "testing", message: "Testing connection..." },
    }));

    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = (await response.json()) as { message?: string; error?: string };

      setIntegrationTests((current) => ({
        ...current,
        [provider]: response.ok
          ? { status: "success", message: data.message ?? "Connection verified." }
          : { status: "error", message: data.error ?? "Connection could not be verified." },
      }));
    } catch {
      setIntegrationTests((current) => ({
        ...current,
        [provider]: { status: "error", message: "Connection could not be verified." },
      }));
    }
  }

  function updateCredential(provider: IntegrationProvider, value: string) {
    if (provider === "gemini") {
      setGeminiApiKey(value);
    } else {
      setApifyApiToken(value);
    }

    setIntegrationTests((current) => ({
      ...current,
      [provider]: { status: "idle", message: null },
    }));
  }

  async function runScrape() {
    if (!integrationsReady) {
      setShowSettings(true);
      setStatus("Connect Gemini and Apify before running your first search.");
      return;
    }

    if (!selectedRoles.length) {
      setStatus("Choose at least one role before you search.");
      return;
    }

    setIsSearching(true);
    setStatus("Preparing your LinkedIn search...");
    setJobs([]);
    setActiveSearch(null);
    try {
      const response = await fetch("/api/jobs/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: selectedRoles.join(" OR "), roles: selectedRoles, locations: selectedLocations, techStack: selectedTechStack, remoteOnly, postedWithin, experienceLevel, maxItems }),
      });
      const data = (await response.json()) as SearchRunResponse & { error?: string };

      if (!response.ok) {
        setIsSearching(false);
        setStatus(data.error ?? "The search could not be started. Please try again.");
        return;
      }

      setActiveSearch(data);
      setStatus(getSearchStage(data.status));
    } catch {
      setIsSearching(false);
      setStatus("We could not reach the search service. Please try again.");
    }
  }

  function getCurrentFilters(): SavedSearchFilters {
    return {
      roles: selectedRoles,
      locations: selectedLocations,
      techStack: selectedTechStack,
      remoteOnly,
      postedWithin,
      experienceLevel,
      maxItems,
    };
  }

  async function saveCurrentSearch() {
    const filters = getCurrentFilters();
    const roleLabel = filters.roles[0] ?? "Job search";
    const locationLabel = filters.locations[0] ?? (filters.remoteOnly ? "Remote" : "Anywhere");

    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${roleLabel} — ${locationLabel}`, filters }),
      });
      const data = (await response.json()) as { search?: SavedSearch; error?: string };

      if (!response.ok || !data.search) {
        setStatus(data.error ?? "We could not save this search.");
        return;
      }

      setSavedSearches((current) => [data.search!, ...current]);
      setStatus("Search saved. You can reuse it from Saved searches.");
    } catch {
      setStatus("We could not save this search.");
    }
  }

  function useSavedSearch(search: SavedSearch) {
    const { filters } = search;
    setSelectedRoles(filters.roles);
    setSelectedLocations(filters.locations);
    setSelectedTechStack(filters.techStack);
    setRemoteOnly(filters.remoteOnly);
    setPostedWithin(filters.postedWithin);
    setExperienceLevel(filters.experienceLevel);
    setMaxItems(filters.maxItems);
    setActiveView("search");
    setStatus(`Loaded “${search.name}”. Review filters and find roles when ready.`);
  }

  async function deleteSearch(searchId: string) {
    const response = await fetch(`/api/saved-searches/${searchId}`, { method: "DELETE" });

    if (response.ok) {
      setSavedSearches((current) => current.filter((search) => search.id !== searchId));
    }
  }

  async function addJobToPipeline(job: Record<string, unknown>) {
    const externalId = getJobValue(job, ["id", "jobId", "job_id"]);
    const title = getJobValue(job, ["title", "jobTitle", "position"]) ?? "Untitled role";
    const company = getJobValue(job, ["company", "companyName", "organization"]) ?? "Company not provided";
    const jobLocation = getJobValue(job, ["location", "jobLocation"]);
    const url = getJobValue(job, ["url", "jobUrl", "link"]);

    if (!externalId) {
      setStatus("This role is missing a stable job identifier.");
      return;
    }

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId, title, company, location: jobLocation ?? null, url: url?.startsWith("http") ? url : null }),
      });
      const data = (await response.json()) as { item?: PipelineItem; error?: string };

      if (!response.ok || !data.item) {
        setStatus(data.error ?? "We could not add this role to your pipeline.");
        return;
      }

      setPipelineItems((current) => [data.item!, ...current.filter((item) => item.id !== data.item!.id)]);
      setStatus("Added to your pipeline.");
    } catch {
      setStatus("We could not add this role to your pipeline.");
    }
  }

  async function updatePipelineStatus(itemId: string, pipelineStatus: PipelineStatus) {
    const response = await fetch(`/api/pipeline/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: pipelineStatus }),
    });
    const data = (await response.json()) as { item?: PipelineItem };

    if (response.ok && data.item) {
      setPipelineItems((current) => current.map((item) => item.id === itemId ? data.item! : item));
    }
  }

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fc]"><span className="loading-orb" /></main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#f8f9fc] text-slate-900">
        <nav className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-5 py-5 sm:flex-row sm:justify-between sm:px-6 sm:py-6 lg:px-8">
          <Logo />
          <button className="text-center text-sm font-semibold text-slate-600 transition hover:text-slate-950" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")} type="button">
            {authMode === "signup" ? "Already a member? Sign in" : "New here? Create an account"}
          </button>
        </nav>

        <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:px-8 lg:pb-28 lg:pt-20">
          <div className="pointer-events-none absolute -left-36 top-16 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-sky-100/80 blur-3xl" />
          <div className="relative">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
              <Icon className="h-3.5 w-3.5" name="sparkle" />
              A calmer way to find your next role
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              Your job search,<br />
              <span className="text-gradient">working smarter.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
              Tell JobPilot what you want. Gemini turns it into a focused search and Apify brings back the opportunities worth your time.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
              {[
                "Personalized searches",
                "Live LinkedIn roles",
                "Your keys, your control",
              ].map((item) => <span className="flex items-center gap-2" key={item}><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Icon className="h-3 w-3" name="check" /></span>{item}</span>)}
            </div>
            <div className="mt-14 max-w-lg rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_18px_60px_-30px_rgba(50,63,110,.38)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-5 w-5" name="sparkle" /></div>
                <div><p className="text-sm font-semibold">Built around your intent</p><p className="mt-0.5 text-xs text-slate-500">AI refines every search before it runs.</p></div>
              </div>
            </div>
          </div>

          <AuthCard authMode={authMode} email={email} password={password} setAuthMode={setAuthMode} setEmail={setEmail} setPassword={setPassword} status={status} onSubmit={submitAuth} />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f6f7fb] text-slate-900">
      <header className="sticky top-0 z-20 w-full border-b border-slate-200/70 bg-[#f6f7fb]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Logo compact />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex"><StatusDot active={integrationsReady} />{integrationsReady ? "Search ready" : "Setup needed"}</div>
            <button aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 lg:hidden" onClick={signOut} type="button"><Icon className="h-4 w-4" name="logout" /></button>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-xs font-bold uppercase text-white" title={user.email ?? "Account"} type="button">{firstName.slice(0, 2)}</button>
          </div>
        </div>
      </header>

      <nav aria-label="Workspace navigation" className="border-b border-slate-200/70 bg-white/60 lg:hidden">
        <div className="grid grid-cols-3 gap-2 px-5 py-3 sm:px-8">
          <MobileNavItem active={activeView === "search"} icon="search" label="Search" onClick={() => setActiveView("search")} />
          <MobileNavItem active={activeView === "saved"} icon="target" label="Saved" onClick={() => setActiveView("saved")} />
          <MobileNavItem active={activeView === "pipeline"} icon="briefcase" label="Pipeline" onClick={() => setActiveView("pipeline")} />
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="sticky top-[76px] hidden h-[calc(100vh-76px)] self-start flex-col border-r border-slate-200/70 px-4 py-7 lg:flex">
          <div className="space-y-1">
            <NavItem active={activeView === "search"} icon="search" label="Search roles" onClick={() => setActiveView("search")} />
            <NavItem active={activeView === "saved"} icon="target" label="Saved searches" onClick={() => setActiveView("saved")} />
            <NavItem active={activeView === "pipeline"} icon="briefcase" label="My pipeline" onClick={() => setActiveView("pipeline")} />
          </div>
          <div className="mt-9 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Workspace</div>
          <div className="mt-3 space-y-1"><NavItem icon="key" label="Integrations" onClick={() => setShowSettings(true)} /></div>
          <div className="mt-auto">
            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <Icon className="h-5 w-5 text-violet-300" name="sparkle" />
              <p className="mt-3 text-sm font-semibold">Search with intent</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Refine roles, locations, and scope with AI before each run.</p>
            </div>
            <button className="mt-5 flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900" onClick={signOut} type="button"><Icon className="h-4 w-4" name="logout" />Sign out</button>
          </div>
        </aside>

        <section className="min-w-0 w-full px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div><p className="text-sm font-medium text-violet-700">Your workspace</p><h1 className="mt-1 break-words text-3xl font-semibold tracking-[-0.04em] text-slate-950">Good to see you, {firstName}.</h1><p className="mt-2 text-sm text-slate-500">Let’s make this next search count.</p></div>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950" onClick={() => setShowSettings((value) => !value)} type="button"><Icon className="h-4 w-4" name="key" />Integrations<Icon className="h-3.5 w-3.5" name="chevron" /></button>
          </div>

          {showSettings ? <IntegrationPanel apifyApiToken={apifyApiToken} geminiApiKey={geminiApiKey} integrationStatus={integrationStatus} integrationTests={integrationTests} isSaving={isSaving} onClose={() => setShowSettings(false)} onCredentialChange={updateCredential} onSave={saveIntegrations} onTest={testIntegration} /> : null}

          {activeView === "search" ? <>
          <section className="mt-8 rounded-3xl bg-slate-950 p-1 shadow-[0_26px_70px_-35px_rgba(27,25,68,.65)]">
            <div className="relative rounded-[22px] bg-[radial-gradient(circle_at_90%_0%,#39386f_0%,#202136_33%,#171827_72%)] px-5 py-6 sm:px-8 sm:py-8">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-violet-300/20" /><div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-violet-300/15" />
              <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-200"><Icon className="h-4 w-4" name="sparkle" />AI-guided role search</div>
              <h2 className="relative mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">What opportunity are you looking for?</h2>
              <div className="relative mt-6 grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-5"><MultiSearchSelect customLabel="Other role" heading="Popular IT roles" icon="search" onChange={setSelectedRoles} options={popularItRoles} placeholder="Choose one or more IT roles" values={selectedRoles} /></div>
                <div className="lg:col-span-4"><MultiSearchSelect customLabel="Other location" heading="Popular locations" icon="location" onChange={setSelectedLocations} options={popularIndianLocations} placeholder="Choose one or more locations" values={selectedLocations} /></div>
                <div className="order-last flex flex-col-reverse gap-2 lg:order-none lg:grid lg:col-span-3"><button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSearching} onClick={runScrape} type="button"><Icon className="h-4 w-4" name={isSearching ? "sparkle" : "arrow"} />{isSearching ? "Searching..." : "Find roles"}</button><button className="text-xs font-semibold text-violet-200 transition hover:text-white" onClick={() => void saveCurrentSearch()} type="button">Save this search</button></div>
                <div className="lg:col-span-4"><MultiSearchSelect customLabel="Other technology" heading="Popular technology stacks" icon="key" onChange={setSelectedTechStack} options={popularTechStacks} placeholder="Choose technology or stack" values={selectedTechStack} /></div>
                <div className="lg:col-span-3"><SearchSelect icon="sparkle" label="posted within" onChange={setPostedWithin} options={postedWithinOptions} placeholder="Choose when the role was posted" value={postedWithin} /></div>
                <div className="lg:col-span-3"><SearchSelect icon="target" label="experience range" onChange={setExperienceLevel} options={experienceLevelOptions} placeholder="Choose experience range" value={experienceLevel} /></div>
                <label className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[.07] px-3 text-sm font-medium text-slate-200 lg:col-span-2"><input checked={remoteOnly} className="accent-violet-400" onChange={(event) => setRemoteOnly(event.target.checked)} type="checkbox" />Also remote</label>
              </div>
              {activeSearch ? <div className="relative mt-5 rounded-xl border border-white/10 bg-black/10 px-3 py-3"><div className="flex items-center justify-between gap-3 text-xs"><span className={`font-semibold ${activeSearch.status === "failed" ? "text-rose-300" : "text-violet-100"}`}>{getSearchStage(activeSearch.status, activeSearch.isScreening)}</span><span className="shrink-0 text-slate-400">{getSearchProgress(activeSearch.status, activeSearch.isScreening)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-all duration-700 ${activeSearch.status === "failed" ? "bg-rose-400" : "bg-violet-300"}`} style={{ width: `${getSearchProgress(activeSearch.status, activeSearch.isScreening)}%` }} /></div></div> : null}
              <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{status}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
                <label className="flex items-center gap-1.5">
                  Show
                  <select aria-label="Maximum jobs" className="bg-transparent font-semibold text-slate-200 outline-none" onChange={(event) => setMaxItems(Number(event.target.value))} value={maxItems}>
                    <option className="text-slate-900" value={10}>10</option>
                    <option className="text-slate-900" value={25}>25</option>
                    <option className="text-slate-900" value={50}>50</option>
                    <option className="text-slate-900" value={100}>100</option>
                  </select>
                  roles
                </label>
                {jobs.length ? (
                  <>
                    <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
                    <label className="flex cursor-pointer items-center gap-1.5 select-none font-medium hover:text-slate-200">
                      <input type="checkbox" checked={hideViewed} onChange={(e) => setHideViewed(e.target.checked)} className="accent-violet-400" />
                      Hide viewed roles ({openedJobIds.filter(id => jobs.some(j => getJobValue(j, ["id", "url", "jobUrl"]) === id)).length} hidden)
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-9">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950">{jobs.length ? "Search results" : "Your next great role starts here"}</h2><p className="mt-1 text-sm text-slate-500">{jobs.length ? `${jobs.length} roles from your latest live search.` : "Connect your tools, then run a search to see new opportunities."}</p></div>{jobs.length ? <div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Best matches first</span><button className="text-sm font-semibold text-violet-700 hover:text-violet-900" onClick={() => setJobs([])} type="button">Clear results</button></div> : null}</div>
            {paginatedJobs.length ? (
              <>
                <div className="mt-5 grid gap-3">
                  {paginatedJobs.map((job, index) => {
                    const jobId = (getJobValue(job, ["id", "url", "jobUrl"]) as string) ?? "";
                    return (
                      <JobCard
                        job={job}
                        key={`${getJobValue(job, ["id", "url", "jobUrl", "title"]) ?? "job"}-${index}`}
                        onAddToPipeline={addJobToPipeline}
                        isOpened={openedJobIds.includes(jobId)}
                        onMarkOpened={() => handleJobOpened(jobId)}
                      />
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-col justify-between gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                    <span className="text-xs text-slate-500">
                      Showing <strong className="font-semibold text-slate-900">{Math.min(displayedJobs.length, (currentPage - 1) * itemsPerPage + 1)}</strong> to{" "}
                      <strong className="font-semibold text-slate-900">{Math.min(displayedJobs.length, currentPage * itemsPerPage)}</strong> of{" "}
                      <strong className="font-semibold text-slate-900">{displayedJobs.length}</strong> roles
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        type="button"
                      >
                        <Icon name="arrow" className="h-4 w-4 rotate-180" />
                      </button>
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                              currentPage === pageNum
                                ? "bg-violet-600 text-white"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                            onClick={() => setCurrentPage(pageNum)}
                            type="button"
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        type="button"
                      >
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : <EmptyState isReady={integrationsReady} onConnect={() => setShowSettings(true)} />}
          </section>
          </> : activeView === "saved" ? <SavedSearchesView searches={savedSearches} onDelete={deleteSearch} onUse={useSavedSearch} /> : <PipelineView items={pipelineItems} onUpdateStatus={updatePipelineStatus} />}
        </section>
      </div>
    </main>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/15"><Icon className="h-5 w-5" name="target" /></span><span className="text-lg font-bold tracking-[-0.04em] text-slate-950">JobPilot</span>{!compact ? <span className="hidden text-xs font-medium text-slate-400 sm:block">Job search, sharpened.</span> : null}</div>;
}

function AuthCard({ authMode, email, password, setAuthMode, setEmail, setPassword, status, onSubmit }: { authMode: "signin" | "signup"; email: string; password: string; setAuthMode: (value: "signin" | "signup") => void; setEmail: (value: string) => void; setPassword: (value: string) => void; status: string; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; }) {
  const isSignUp = authMode === "signup";
  return <div className="relative rounded-3xl border border-white/80 bg-white/90 p-2 shadow-[0_24px_70px_-32px_rgba(48,58,105,.35)] backdrop-blur sm:p-3"><div className="rounded-[20px] bg-white p-6 sm:p-8"><p className="text-sm font-semibold text-violet-700">Welcome to JobPilot</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{isSignUp ? "Build your search space." : "Pick up where you left off."}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isSignUp ? "Create an account to save your private search integrations." : "Sign in to continue searching with your connected tools."}</p><div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button className={`rounded-lg py-2 text-sm font-semibold transition ${isSignUp ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={() => setAuthMode("signup")} type="button">Create account</button><button className={`rounded-lg py-2 text-sm font-semibold transition ${!isSignUp ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} onClick={() => setAuthMode("signin")} type="button">Sign in</button></div><form className="mt-6 space-y-4" onSubmit={(event) => void onSubmit(event)}><label className="block text-sm font-semibold text-slate-700">Email<input autoComplete="email" className="auth-input mt-1.5" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></label><label className="block text-sm font-semibold text-slate-700">Password<input autoComplete={isSignUp ? "new-password" : "current-password"} className="auth-input mt-1.5" minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required type="password" value={password} /></label><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700" type="submit">{isSignUp ? "Create my workspace" : "Sign in to JobPilot"}<Icon className="h-4 w-4" name="arrow" /></button></form><p className="mt-4 text-center text-xs leading-5 text-slate-500">{status}</p></div></div>;
}

function NavItem({ active = false, icon, label, onClick }: { active?: boolean; icon: IconName; label: string; onClick?: () => void }) {
  return <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`} onClick={onClick} type="button"><Icon className="h-4 w-4" name={icon} />{label}</button>;
}

function MobileNavItem({ active = false, icon, label, onClick }: { active?: boolean; icon: IconName; label: string; onClick: () => void }) {
  return <button aria-current={active ? "page" : undefined} className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"}`} onClick={onClick} type="button"><Icon className="h-4 w-4" name={icon} />{label}</button>;
}

function IntegrationPanel({
  apifyApiToken,
  geminiApiKey,
  integrationStatus,
  integrationTests,
  isSaving,
  onClose,
  onCredentialChange,
  onSave,
  onTest,
}: {
  apifyApiToken: string;
  geminiApiKey: string;
  integrationStatus: IntegrationStatus;
  integrationTests: Record<IntegrationProvider, IntegrationTestState>;
  isSaving: boolean;
  onClose: () => void;
  onCredentialChange: (provider: IntegrationProvider, value: string) => void;
  onSave: () => Promise<void>;
  onTest: (provider: IntegrationProvider) => Promise<void>;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><Icon className="h-4 w-4" name="key" />Private integrations</div>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Connect your own API keys</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Test each credential before you save it. Keys are encrypted before they enter the database.</p>
        </div>
        <button className="text-sm font-semibold text-slate-400 hover:text-slate-700" onClick={onClose} type="button">Close</button>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CredentialField
          active={integrationStatus.hasGeminiKey}
          label="Gemini API key"
          onChange={(value) => onCredentialChange("gemini", value)}
          onTest={() => void onTest("gemini")}
          placeholder={integrationStatus.hasGeminiKey ? "Connected — enter a new key to replace" : "Paste your Gemini API key"}
          test={integrationTests.gemini}
          value={geminiApiKey}
        />
        <CredentialField
          active={integrationStatus.hasApifyToken}
          label="Apify API token"
          onChange={(value) => onCredentialChange("apify", value)}
          onTest={() => void onTest("apify")}
          placeholder={integrationStatus.hasApifyToken ? "Connected — enter a new token to replace" : "Paste your Apify API token"}
          test={integrationTests.apify}
          value={apifyApiToken}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <p className="text-xs text-slate-500">Saving performs a final validation, too.</p>
        <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60" disabled={isSaving} onClick={() => void onSave()} type="button">{isSaving ? "Saving..." : "Save integrations"}</button>
      </div>
    </section>
  );
}

function CredentialField({ active, label, onChange, onTest, placeholder, test, value }: { active: boolean; label: string; onChange: (value: string) => void; onTest: () => void; placeholder: string; test: IntegrationTestState; value: string; }) {
  const feedbackClass = test.status === "success" ? "text-emerald-600" : "text-rose-600";

  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><StatusDot active={active} />{label}</span>
      <div className="mt-2 flex gap-2">
        <input className="auth-input min-w-0" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="password" value={value} />
        <button className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={test.status === "testing" || !value} onClick={onTest} type="button">{test.status === "testing" ? "Testing..." : "Test"}</button>
      </div>
      {test.message ? <p className={`mt-2 text-xs ${feedbackClass}`}>{test.message}</p> : null}
    </label>
  );
}

function EmptyState({ isReady, onConnect }: { isReady: boolean; onConnect: () => void }) {
  return <div className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon className="h-6 w-6" name={isReady ? "search" : "key"} /></div><h3 className="mt-4 font-semibold text-slate-900">{isReady ? "Ready to uncover a great fit" : "One small step before your first search"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{isReady ? "Choose a role, location, and search scope above. We’ll bring the fresh roles back here." : "Connect Gemini and Apify with your own API credentials. It takes about a minute."}</p>{!isReady ? <button className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700" onClick={onConnect} type="button">Connect integrations</button> : null}</div></div>;
}

function JobCard({
  job,
  onAddToPipeline,
  isOpened,
  onMarkOpened,
}: {
  job: Record<string, unknown>;
  onAddToPipeline: (job: Record<string, unknown>) => Promise<void>;
  isOpened: boolean;
  onMarkOpened: () => void;
}) {
  const title = getJobValue(job, ["title", "jobTitle", "position", "job_title"]) ?? "Untitled role";
  const company = getJobValue(job, ["companyName", "company", "company_name", "organization"]) ?? "Company not provided";
  const jobLocation = getJobValue(job, ["location", "jobLocation", "job_location"]) ?? "Location not provided";
  const url = getJobValue(job, ["jobUrl", "url", "link", "job_url"]);
  const description = getJobValue(job, ["description", "jobDescription", "summary"]);

  let matchScore = typeof job.matchScore === "number" ? job.matchScore : undefined;
  if (matchScore === undefined && typeof job.match_score === "number") {
    matchScore = job.match_score;
  }

  let displayDescription = description as string | null;
  if (displayDescription && matchScore === undefined) {
    const matchRegex = /^\[Match Score:\s*(\d+)%\]\n(?:\[Reason:\s*[^\]\n]+\]\n)?\n/;
    const matchResult = matchRegex.exec(displayDescription);
    if (matchResult) {
      if (matchScore === undefined) {
        matchScore = parseInt(matchResult[1], 10);
      }
      displayDescription = displayDescription.replace(matchRegex, "");
    }
  }
  const matchLabel = matchScore === undefined
    ? null
    : matchScore >= 90
      ? "Perfect match"
      : matchScore >= 80
        ? "Strong match"
        : matchScore >= 70
          ? "Good match"
          : "Potential match";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
              {company.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="truncate font-semibold tracking-[-0.02em] text-slate-950">{title}</h3>
                {matchScore !== undefined ? (
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    matchScore >= 90
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : matchScore >= 75
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    <Icon className="h-3.5 w-3.5" name="sparkle" />{matchLabel} · {matchScore}%
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{company}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" name="location" />{jobLocation}</span>
            <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" name="briefcase" />LinkedIn listing</span>
          </div>

          {displayDescription ? <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-500">{displayDescription}</p> : null}

        </div>

        <div className="flex shrink-0 items-center gap-2 sm:items-end">
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700" onClick={() => void onAddToPipeline(job)} type="button">Track</button>
            {url ? <a className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700" href={url} onClick={onMarkOpened} rel="noreferrer" target="_blank">{isOpened ? "Already viewed" : "View"}<Icon className="h-3.5 w-3.5" name="arrow" /></a> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SavedSearchesView({ searches, onDelete, onUse }: { searches: SavedSearch[]; onDelete: (searchId: string) => Promise<void>; onUse: (search: SavedSearch) => void }) {
  return <section className="mt-8"><div><p className="text-sm font-medium text-violet-700">Your presets</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Saved searches</h2><p className="mt-2 text-sm text-slate-500">Reuse your best filter combinations whenever you need them.</p></div><div className="mt-6 grid gap-3">{searches.length ? searches.map((search) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={search.id}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-slate-900">{search.name}</h3><p className="mt-1 text-sm text-slate-500">{search.filters.roles.join(", ") || "Any role"} · {search.filters.locations.join(", ") || "Any location"}</p><p className="mt-1 text-xs text-slate-400">{search.filters.techStack.join(", ") || "Any technology"} · {search.filters.experienceLevel}</p></div><div className="flex gap-2"><button className="rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700" onClick={() => onUse(search)} type="button">Use search</button><button className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" onClick={() => void onDelete(search.id)} type="button">Delete</button></div></div></article>) : <WorkspaceEmpty icon="target" message="Save a configured role search to reuse it here." title="No saved searches yet" />}</div></section>;
}

function PipelineView({ items, onUpdateStatus }: { items: PipelineItem[]; onUpdateStatus: (itemId: string, status: PipelineStatus) => Promise<void> }) {
  const statuses: PipelineStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];
  return <section className="mt-8"><div><p className="text-sm font-medium text-violet-700">Your application tracker</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">My pipeline</h2><p className="mt-2 text-sm text-slate-500">Keep the roles you care about moving forward.</p></div><div className="mt-6 grid gap-3">{items.length ? items.map((item) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.company}{item.location ? ` · ${item.location}` : ""}</p></div>{item.url ? <a className="text-sm font-semibold text-violet-700 hover:text-violet-900" href={item.url} rel="noreferrer" target="_blank">View role →</a> : null}</div><div className="mt-4 flex flex-wrap gap-2">{statuses.map((status) => <button className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${item.status === status ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700"}`} key={status} onClick={() => void onUpdateStatus(item.id, status)} type="button">{status}</button>)}</div></article>) : <WorkspaceEmpty icon="briefcase" message="Use Track on any job result to add it to your application workflow." title="Your pipeline is empty" />}</div></section>;
}

function WorkspaceEmpty({ icon, message, title }: { icon: IconName; message: string; title: string }) {
  return <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-5 w-5" name={icon} /></div><h3 className="mt-4 font-semibold text-slate-900">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{message}</p></div></div>;
}
