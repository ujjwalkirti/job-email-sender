package referral;

import java.util.Scanner;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;

class GenerateReferralMessage {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        // get recipient name
        System.out.print("Enter recipient's name: ");
        String recipientName = sc.nextLine().trim();

        // get recipient designation
        System.out.print("Enter recipient's designation: ");
        String designation = sc.nextLine().trim();

        // get company name
        System.out.print("Enter company name: ");
        String companyName = sc.nextLine().trim();

        // get job id
        System.out.print("Enter job id: ");
        String jobId = sc.nextLine().trim();

        // get your name
        System.out.print("Enter your name: ");
        String yourName = sc.nextLine().trim();

        // get resume link
        System.out.print("Enter your resume link (press Enter to use default): ");
        String resumeLink = sc.nextLine().trim();
        if (resumeLink.isEmpty()) {
            resumeLink = "https://drive.google.com/file/d/1LoF14oDU1YKTzCFeobmq8aEEpWR1YwaI/view?usp=sharing";
        }

        // produce output text using template
        String message = String.format(
                "Hi %s,\n" +
                        "I noticed that you are currently working as %s at %s, can you take out some time to refer me for a job?\n\n"
                        +
                        "Job Id:%s \n\n" +
                        "I have been working as a full stack developer for the past 2 years, and have lots of experience in the field.\n\n"
                        +
                        "Here's the link to my resume: %s\n\n" +
                        "Regards\n%s",
                recipientName, designation, companyName, jobId, resumeLink, yourName);

        // add it to clipboard
        try {
            StringSelection selection = new StringSelection(message);
            Toolkit.getDefaultToolkit().getSystemClipboard().setContents(selection, null);
            System.out.println("\nReferral message generated and copied to clipboard:\n");
        } catch (Exception e) {
            System.out.println("\nReferral message generated (could not copy to clipboard):\n");
        }
        System.out.println(message);

        sc.close();
    }
}