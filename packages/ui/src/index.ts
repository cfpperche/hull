export { cn, initial } from "./lib/utils";
export { Button, buttonVariants } from "./components/ui/button";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { Toaster } from "./components/ui/sonner";
export { ConfirmDialog, type ConfirmDialogProps } from "./components/ui/confirm-dialog";
export { ProductShell, Page, type ShellNavItem, type ShellNavGroup } from "./components/ProductShell";
export { AppErrorBoundary } from "./components/AppErrorBoundary";
export { ThemePreference } from "./components/ThemePreference";
export { BrandGate, useBrand } from "./components/BrandGate";
export {
  LocaleProvider,
  Fill,
  useT,
  useLocale,
  useAccountLocale,
  useErrMsg,
} from "./components/LocaleProvider";
export { BrandMark, AuthScreen } from "./components/BrandMark";
export { UserMenu, type UserMenuItem, type UserMenuProps } from "./components/UserMenu";
// Account sections. Shell, not product — both surfaces manage the same login,
// and each passes its own client rather than the kit importing one.
export { ProfileForm } from "./components/account/ProfileForm";
export { EmailSection } from "./components/account/EmailSection";
export { PasswordForm } from "./components/account/PasswordForm";
export { SessionList } from "./components/account/SessionList";
export { LanguagePreference } from "./components/account/LanguagePreference";
