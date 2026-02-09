import { CheckCircle2 } from 'lucide-react';

const ReviewComplete = () => (
  <div className="text-center space-y-4 py-12">
    <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
    <h2 className="text-2xl font-bold text-foreground">All done!</h2>
    <p className="text-muted-foreground">Come back tomorrow for more review.</p>
  </div>
);

export default ReviewComplete;
