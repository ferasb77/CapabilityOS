"use client";

import { useState } from "react";

import { createWorkshop } from "../actions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateWorkshopDialog() {
  const [open, setOpen] = useState(false);

  async function submit(formData: FormData) {
    await createWorkshop(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        + New Workshop
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Workshop</DialogTitle>
        </DialogHeader>

        <form action={submit} className="space-y-5">

          <div>
            <Label>Title</Label>
            <Input
              name="title"
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              name="description"
            />
          </div>

          <div>
            <Label>Venue</Label>
            <Input
              name="venue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div>
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                name="start_date"
                required
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                name="end_date"
                required
              />
            </div>

          </div>

          <div>
            <Label>Capacity</Label>

            <Input
              type="number"
              name="capacity"
              defaultValue={25}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
          >
            Save Workshop
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}