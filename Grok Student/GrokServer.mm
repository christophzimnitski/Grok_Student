//
//  GrokServer.mm
//  Grok Student
//

#import "GrokServer.h"
#import <GCDWebServer/GCDWebServerDataResponse.h>
#import <GCDWebServer/GCDWebServerDataRequest.h>
#import <ifaddrs.h>
#import <arpa/inet.h>
#import "KeychainHelper.h"

@interface GrokServer ()

@property (nonatomic, strong, readwrite) GCDWebServer *webServer;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *chatHistory;

@end

@implementation GrokServer

@synthesize selectedAPI = _selectedAPI;

- (instancetype)init {
    self = [super init];
    if (self) {
        _chatHistory = [NSMutableArray array];
        _bonjourName = @"grokstudent";
        _selectedAPI = [[NSUserDefaults standardUserDefaults] stringForKey:@"selectedAPI"] ?: @"groq";
    }
    return self;
}

- (BOOL)startServer {
    if (self.webServer && [self.webServer isRunning]) {
        _port = self.webServer.port;
        return YES;
    }

    GCDWebServer *server = [[GCDWebServer alloc] init];
    
    NSString *webFolderPath = [[NSBundle mainBundle] pathForResource:@"Web" ofType:nil];
    if (!webFolderPath) {
        NSLog(@"Error: 'Web' folder not found in app bundle!");
        return NO;
    }
    
    [server addGETHandlerForBasePath:@"/"
                       directoryPath:webFolderPath
                       indexFilename:@"index.html"
                           cacheAge:3600
                 allowRangeRequests:YES];
    
    [server addHandlerForMethod:@"POST"
                           path:@"/prompt"
                   requestClass:[GCDWebServerDataRequest class]
                   processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
        
        GCDWebServerDataRequest *dataRequest = (GCDWebServerDataRequest *)request;
        
        NSError *jsonError = nil;
        NSDictionary *jsonBody = [NSJSONSerialization JSONObjectWithData:dataRequest.data options:0 error:&jsonError];
        
        NSString *userPrompt = nil;
        NSString *base64File = nil;
        
        if (jsonBody && [jsonBody isKindOfClass:[NSDictionary class]]) {
            id textObj = jsonBody[@"text"];
            if ([textObj isKindOfClass:[NSString class]]) {
                userPrompt = textObj;
            }
            
            // Backwards compatibility for the original "image" key
            id imageObj = jsonBody[@"image"];
            if ([imageObj isKindOfClass:[NSString class]]) {
                base64File = imageObj;
            }
            
            id fileDataObj = jsonBody[@"file_data"];
            if ([fileDataObj isKindOfClass:[NSString class]]) {
                base64File = fileDataObj;
            }
        } else {
            // Fallback for plain text parsing
            userPrompt = dataRequest.text;
        }
        
        if ((!userPrompt || userPrompt.length == 0) && (!base64File || base64File.length == 0)) {
            return [GCDWebServerDataResponse responseWithText:@"Error: Empty prompt"];
        }
        
        NSLog(@"User prompt: %@", userPrompt);
        
        NSMutableArray *parts = [NSMutableArray array];
        if (userPrompt && userPrompt.length > 0) {
            [parts addObject:@{ @"text": userPrompt }];
        }
        
        if (base64File && base64File.length > 0) {
            NSString *cleanBase64 = base64File;
            NSRange range = [base64File rangeOfString:@"base64,"];
            if (range.location != NSNotFound) {
                cleanBase64 = [base64File substringFromIndex:range.location + range.length];
                
                NSString *mimeType = @"application/octet-stream"; // Default for generic files
                NSRange mimeRange = [base64File rangeOfString:@";"];
                if (mimeRange.location != NSNotFound && mimeRange.location > 5) {
                    mimeType = [base64File substringWithRange:NSMakeRange(5, mimeRange.location - 5)];
                }
                
                [parts addObject:@{
                    @"inlineData": @{
                        @"mimeType": mimeType,
                        @"data": cleanBase64
                    }
                }];
            }
        }
        
        [self.chatHistory addObject:@{ @"role": @"user",
                                       @"parts": parts }];
        
        NSString *assistantResponse = [self callAPIWithHistory];
        
        if (assistantResponse && ![assistantResponse hasPrefix:@"Error"]) {
            [self.chatHistory addObject:@{ @"role": @"model",
                                           @"parts": @[ @{ @"text": assistantResponse } ] }];
        }
        
        return [GCDWebServerDataResponse responseWithText:assistantResponse];
    }];
    
    [server addHandlerForMethod:@"POST"
                           path:@"/clear"
                   requestClass:[GCDWebServerRequest class]
                   processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
        [self clearHistory];
        return [GCDWebServerDataResponse responseWithText:@"Chat history cleared!"];
    }];
    
    [server addHandlerForMethod:@"GET"
                           path:@"/hosts"
                   requestClass:[GCDWebServerRequest class]
                   processBlock:^GCDWebServerResponse *(GCDWebServerRequest *request) {
        NSString *ip = [self localIPAddress];
        if (ip.length == 0) { ip = @"127.0.0.1"; }
        NSString *line = [NSString stringWithFormat:@"%@ grokstudent.local", ip];
        NSString *text = [NSString stringWithFormat:@"# To access http://grokstudent.local:8080 on this network, add this line to /etc/hosts on your Mac or to /Windows/System32/drivers/etc/hosts on your PC:\n%@\n", line];
        return [GCDWebServerDataResponse responseWithText:text];
    }];
    
    NSInteger desiredPort = 8080;
    BOOL success = [server startWithPort:desiredPort bonjourName:self.bonjourName];
    if (success) {
        self.webServer = server;
        _port = desiredPort;
        
        NSURL *url = server.serverURL;
        NSLog(@"Grok Student server started successfully.");
        if (url) {
            NSLog(@"Accessible at: %@", url.absoluteString);
        } else {
            NSLog(@"Accessible at: http://%@:%ld/", [self localIPAddress], (long)_port);
        }
        NSString *ip = [self localIPAddress];
        NSLog(@"Also try: http://%@:%ld", ip, (long)_port);
        NSLog(@"Tip: To use http://grokstudent.local:%ld on your computer, map it to %@ in /etc/hosts for Mac and /Windows/System32/drivers/etc/hosts for Windows. See: http://%@:%ld/hosts", (long)_port, ip, ip, (long)_port);
    }
    
    return success;
}

- (NSString *)callAPIWithHistory {
    NSString *apiKey = [KeychainHelper getAPIKeyForAPI:self.selectedAPI];
    if (!apiKey || apiKey.length == 0) {
        return [NSString stringWithFormat:@"Error: No %@ API key set. Please enter your %@ API key in the app settings.", self.selectedAPI.capitalizedString, self.selectedAPI.capitalizedString];
    }

    NSString *urlString;
    NSDictionary *body = nil;
    NSMutableURLRequest *request;
    NSString *model;

    if ([self.selectedAPI isEqualToString:@"groq"]) {
        model = @"llama-3.3-70b-versatile";

        NSMutableArray *messages = [NSMutableArray array];

        for (NSDictionary *entry in self.chatHistory) {
            NSString *role = entry[@"role"];
            NSArray *parts = entry[@"parts"];

            if (parts.count > 0) {
                NSMutableString *content = [NSMutableString string];
                for (NSDictionary *part in parts) {
                    if (part[@"text"]) {
                        if (content.length > 0) [content appendString:@"\n"];
                        [content appendString:part[@"text"]];
                    } else if (part[@"inlineData"]) {
                        if (content.length > 0) [content appendString:@"\n"];
                        [content appendString:@"[File attached but ignored; Groq does not support file/image input in this mode]"];
                    }
                }

                NSString *groqRole = [role isEqualToString:@"user"] ? @"user" : ([role isEqualToString:@"model"] ? @"assistant" : nil);
                if (groqRole) {
                    [messages addObject:@{ @"role": groqRole, @"content": content }];
                }
            }
        }

        body = @{
            @"model": model,
            @"messages": messages,
            @"temperature": @0.7,
            @"max_completion_tokens": @(8192 * 4)
        };

        urlString = @"https://api.groq.com/openai/v1/chat/completions";

        request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:urlString]];
        request.HTTPMethod = @"POST";
        [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
        [request setValue:[NSString stringWithFormat:@"Bearer %@", apiKey] forHTTPHeaderField:@"Authorization"];

    } else if ([self.selectedAPI isEqualToString:@"gemini"]) {
        model = @"gemini-2.5-flash";

        body = @{
            @"contents": self.chatHistory,
            @"generationConfig": @{
                @"temperature": @0.7,
                @"maxOutputTokens": @(8192 * 4)
            }
        };

        urlString = [NSString stringWithFormat:@"https://generativelanguage.googleapis.com/v1beta/models/%@:generateContent?key=%@", model, apiKey];

        request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:urlString]];
        request.HTTPMethod = @"POST";
        [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    } else {
        return @"Error: Unsupported API selected.";
    }

    NSError *jsonError = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
    if (jsonError) {
        return @"Error: Failed to create JSON request";
    }

    request.HTTPBody = jsonData;

    NSError *error = nil;
    NSData *data = [NSURLConnection sendSynchronousRequest:request returningResponse:nil error:&error];

    if (error) {
        NSLog(@"Network Error: %@", error.localizedDescription);
        return [NSString stringWithFormat:@"Network Error: %@", error.localizedDescription];
    }

    NSError *parseError = nil;
    NSDictionary *response = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
        return @"Error: Failed to parse API response";
    }

    NSString *content = nil;
    NSString *finishReason = nil;

    if ([self.selectedAPI isEqualToString:@"groq"]) {
        if (!response[@"choices"]) {
            NSString *errorMsg = response[@"error"][@"message"] ?: @"Unknown Groq API error";
            NSLog(@"Groq API Error: %@", errorMsg);
            return [NSString stringWithFormat:@"API Error: %@", errorMsg];
        }
        NSDictionary *choice = [response[@"choices"] firstObject];
        content = choice[@"message"][@"content"];
        finishReason = choice[@"finish_reason"];
    } else if ([self.selectedAPI isEqualToString:@"gemini"]) {
        if (response[@"error"]) {
            NSString *errorMsg = response[@"error"][@"message"] ?: @"Unknown Gemini API error";
            NSLog(@"Gemini API Error: %@", errorMsg);
            return [NSString stringWithFormat:@"API Error: %@", errorMsg];
        }
        content = response[@"candidates"][0][@"content"][@"parts"][0][@"text"];
        finishReason = response[@"candidates"][0][@"finishReason"];
    }

    NSLog(@"%@ finish reason: %@ | content length: %lu", self.selectedAPI.capitalizedString, finishReason, (unsigned long)content.length);

    return content.length > 0 ? content : @"No response from model";
}

- (void)clearHistory {
    [self.chatHistory removeAllObjects];
    NSLog(@"Chat history cleared");
}

- (void)stopServer {
    if (self.webServer && [self.webServer isRunning]) {
        [self.webServer stop];
    }
    self.webServer = nil;
    _port = 0;
    NSLog(@"Grok Student server stopped.");
}

- (NSString *)localIPAddress {
    struct ifaddrs *interfaces = NULL;
    if (getifaddrs(&interfaces) == 0) {
        for (struct ifaddrs *addr = interfaces; addr != NULL; addr = addr->ifa_next) {
            if (addr->ifa_addr->sa_family == AF_INET) {
                NSString *name = [NSString stringWithUTF8String:addr->ifa_name];
                if ([name isEqualToString:@"en0"]) {
                    NSString *ip = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)addr->ifa_addr)->sin_addr)];
                    freeifaddrs(interfaces);
                    return ip;
                }
            }
        }
        freeifaddrs(interfaces);
    }
    return @"localhost";
}

@end
