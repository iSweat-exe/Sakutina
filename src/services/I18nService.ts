import i18next from 'i18next';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

// Initialize i18next synchronously or asynchronously
const enCommon = JSON.parse(
    readFileSync(
        join(process.cwd(), 'src', 'locales', 'en', 'common.json'),
        'utf-8'
    )
);
const frCommon = JSON.parse(
    readFileSync(
        join(process.cwd(), 'src', 'locales', 'fr', 'common.json'),
        'utf-8'
    )
);

i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
        en: { common: enCommon },
        fr: { common: frCommon },
    },
});

export class I18nService {
    public static translate(key: string, options?: any): string {
        return i18next.t(key, options) as string;
    }
}
