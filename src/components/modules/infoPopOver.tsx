"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "../elements/button";
import { Popover, PopoverContent, PopoverTrigger } from "../elements/popOver";

interface Ipopover {
  title: string;
  description: string;
}
export function InfoPopover({ title, description }: Ipopover) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-10 rounded-full bg-base-200 p-0">
          <HelpCircle className="h-5 w-5 text-primary" />
          <span className="sr-only">Open popover</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">{title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
