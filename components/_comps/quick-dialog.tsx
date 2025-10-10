"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function useQuickDialog() {
  const [open, setOpen] = React.useState(false)
  const [content, setContent] = React.useState<React.ReactNode>(null)
  const show = (node: React.ReactNode) => {
    setContent(node)
    setOpen(true)
  }
  const hide = () => setOpen(false)
  const element = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Action</DialogTitle>
          <DialogDescription>Here’s a quick confirmation.</DialogDescription>
        </DialogHeader>
        <div className="py-2">{content}</div>
        <DialogFooter>
          <Button onClick={hide} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  return { show, hide, element }
}
