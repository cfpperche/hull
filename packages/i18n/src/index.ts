export {
  LOCALES,
  LOCALE_NAMES,
  DEFAULT_LOCALE,
  isLocale,
  negotiate,
  best,
  type Locale,
} from "./locales";
export {
  catalog,
  createT,
  fill,
  holes,
  segments,
  type PluralKey,
  type Segment,
  type T,
  type Values,
} from "./translate";
export { en, type Catalog, type MessageKey } from "./catalogs/en";
