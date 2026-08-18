import { MANIFEST, current, write } from "./manifest";

if (current()) {
  console.log(`I18N_BUILD_OK (unchanged) -> ${MANIFEST}`);
} else {
  write();
  console.log(`I18N_BUILD_OK -> ${MANIFEST}`);
}
