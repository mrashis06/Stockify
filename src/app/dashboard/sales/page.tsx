import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SalesPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight mb-6">Sales</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Sales Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This is the sales page. The sales summary has been moved to the reports page.</p>
                </CardContent>
            </Card>
        </div>
    )
}
