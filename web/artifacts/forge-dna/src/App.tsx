import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Home from "@/pages/home";
import SchemasPage from "@/pages/schemas/index";
import SchemaDetailPage from "@/pages/schemas/detail";
import SchemaEditor from "@/pages/schemas/editor";
import PlayPage from "@/pages/play";
import GuidePage from "@/pages/guide";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/schemas" component={SchemasPage} />
        <Route path="/schemas/new" component={SchemaEditor} />
        <Route path="/schemas/:id/edit" component={SchemaEditor} />
        <Route path="/schemas/:id" component={SchemaDetailPage} />
        <Route path="/play/:slug" component={PlayPage} />
        <Route path="/guide" component={GuidePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
