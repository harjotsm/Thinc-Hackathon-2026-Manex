"use client";

import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  incidentId: string;
  initiativeCount: number;
};

/**
 * "Dispatch all" entry point in the Canvas header. Opens a confirm dialog
 * before routing to the /resolve review page — a one-click safety net so
 * the button on the hottest surface of the app can't be fired by accident.
 */
export function DispatchAllButton({ incidentId, initiativeCount }: Props) {
  const [open, setOpen] = useState(false);
  const href = `/incident/${incidentId}/resolve`;
  const disabled = initiativeCount === 0;

  return (
    <>
      <Button
        variant="default"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Dispatch all
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Review {initiativeCount} initiative
              {initiativeCount === 1 ? "" : "s"} before dispatch?
            </DialogTitle>
            <DialogDescription>
              Continuing opens the resolve page where each suggested initiative
              can be inspected, edited, and pushed to its system of record
              (MES, SRM, JIRA…). No external calls happen until you confirm
              there.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose
              render={
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              }
            />
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              render={<Link href={href} />}
              onClick={() => setOpen(false)}
            >
              <Send className="size-3" />
              Open resolve page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
