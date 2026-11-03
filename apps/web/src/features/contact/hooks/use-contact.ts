"use client";

import { useMutation } from "@tanstack/react-query";
import { contactService } from "../services/contact.service";

export function useContact() {
  return useMutation({ mutationFn: contactService.send });
}
