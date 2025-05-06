import { SignUp } from "@clerk/nextjs";
import React from "react";

const SignUpPage: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <SignUp path="/sign-up" />
    </div>
  );
};

export default SignUpPage; 