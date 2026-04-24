import { useAuth } from "@/contexts/AuthContext";
import Login from "./Login";
import Hub from "./Hub";

const Index = () => {
  const { user } = useAuth();
  // After login, land on the systems portal so users can pick what to open.
  return user ? <Hub /> : <Login />;
};

export default Index;
