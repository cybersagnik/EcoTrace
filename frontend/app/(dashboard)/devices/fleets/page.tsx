"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FleetsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/fleet");
  }, [router]);

  return null;
}
