import { ApifyClient } from "apify-client";

type RunLinkedInScraperArgs = {
    apifyToken: string;
    actorId: string;
    actorInput: Record<string, unknown>;
};

export async function runLinkedInScraper({
    apifyToken,
    actorId,
    actorInput,
}: RunLinkedInScraperArgs) {
    const client = new ApifyClient({ token: apifyToken });

    const run = await client.actor(actorId).call(actorInput);

    if (!run.defaultDatasetId) {
        throw new Error("Apify actor finished without a dataset.");
    }

    const datasetItems = await client.dataset(run.defaultDatasetId).listItems();

    return {
        runId: run.id,
        datasetId: run.defaultDatasetId,
        items: datasetItems.items,
    };
}

export async function startLinkedInScraper({
    apifyToken,
    actorId,
    actorInput,
}: RunLinkedInScraperArgs) {
    const client = new ApifyClient({ token: apifyToken });
    const run = await client.actor(actorId).start(actorInput);

    return {
        runId: run.id,
        status: run.status,
    };
}

export async function getLinkedInScraperRun(
    apifyToken: string,
    runId: string,
) {
    const client = new ApifyClient({ token: apifyToken });

    return client.run(runId).get();
}

export async function getLinkedInScraperDatasetItems(
    apifyToken: string,
    datasetId: string,
) {
    const client = new ApifyClient({ token: apifyToken });
    const datasetItems = await client.dataset(datasetId).listItems();

    return datasetItems.items;
}

export async function validateApifyApiToken(apifyToken: string) {
    const client = new ApifyClient({ token: apifyToken });
    const user = await client.user().get();

    if (!user?.username) {
        throw new Error("Apify did not return an account for this token.");
    }

    return user.username;
}
