import i18next from 'i18next';
import enCommon from '../locales/en/common.json';
import frCommon from '../locales/fr/common.json';

await i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    ns: 'common',
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
