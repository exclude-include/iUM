"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthCodeErrorPage() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">Authentication Error</CardTitle>
                    <CardDescription>
                        There was a problem signing you in. This could be due to an expired or invalid authentication code.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        className="w-full"
                        onClick={() => router.push("/login")}
                    >
                        Try Again
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push("/")}
                    >
                        Go to Home
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
