import PublicWelcome from "./PublicWelcome";

export default function ReviewHold({support}:{support?:{supportEmail:string;privacyEmail:string}|null}) {
  return <PublicWelcome accessReady={false} support={support}/>;
}
