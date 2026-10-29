import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";

type LinkButtonProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

// A navigation link styled as a button. Use instead of <Button render={<Link />}>, which
// would announce it as a button. cn() resolves conflicting classes the way <Button> does
// (e.g. the base border-transparent vs the outline variant's border).
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
