import { SignIn } from "@clerk/nextjs";
import React from "react";

const SignInPage: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <SignIn path="/sign-in" />
    </div>
  );
};

export default SignInPage; 