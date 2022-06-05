/**
 * Executes the regular expression over and over on the given text until all matches are found.
 * @param regex The regular expression.
 * @param text The text.
 */
export function regexGetAllResults(regex: RegExp, text: string): RegExpExecArray[] {
    const results: RegExpExecArray[] = [];
    let record: RegExpExecArray | null;
    while (record = regex.exec(text)) {
        results.push(record);
    }

    return results;
}

export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export async function* iterateYoutubePages<
    TItem,
    TContinuation,
    TResult extends { items: TItem[]; continuation: TContinuation | null; }
>(
    start: TResult,
    resolveContinuation: (x: TContinuation) => Promise<TResult>
): AsyncGenerator<TItem, void, TItem> {
    let result: TResult | null = start;
    while (result) {
        for (const item of result.items) {
            yield item;
        }
        result = result.continuation ? await resolveContinuation(result.continuation) : null;
    }
}

export async function asyncTakeFirst<TItem>(iterator: AsyncGenerator<TItem, void, unknown>, filter: (item: TItem, index: number) => boolean): Promise<TItem | null> {
    let index = 0;
    for await (const item of iterator) {
        if (filter(item, index)) {
            return item;
        }
        index++;
    }

    return null;
}

export async function asyncTakeAll<TItem>(iterator: AsyncGenerator<TItem, void, undefined>): Promise<TItem[]> {
    const items = [];
    for await (const item of iterator) {
        items.push(item);
    }

    return items;
}

export const isUrlRegex = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/;

export function asyncDelay(millis: number): Promise<void> {
    return new Promise(resolve => setTimeout(() => resolve(), millis));
}

export function convertSecondsToTimeString(seconds: number): string {
    if (seconds < 3600) {
        return new Date(seconds * 1000).toISOString().substr(14, 5);
    } else if (seconds < 86400) {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    } else {
        return '> 24h';
    }
}

export const nothingAsync: () => Promise<void> = () => Promise.resolve();
